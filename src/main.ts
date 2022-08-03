import * as artifact from '@actions/artifact'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import * as os from 'os'
import * as path from 'path'
import {Formatter} from './formatter'
import {Octokit} from '@octokit/action'
import {glob} from 'glob'
import {promises} from 'fs'
import {Annotation, TestReport} from './report'

const {stat} = promises

interface ReportOutput {
  title: string
  summary: string
  text?: string
  annotations: Annotation[]
}

async function run(): Promise<void> {
  try {
    const inputPaths = core.getMultilineInput('path')
    const showPassedTests = core.getBooleanInput('show-passed-tests')
    const showCodeCoverage = core.getBooleanInput('show-code-coverage')
    const uploadBundles = core.getBooleanInput('upload-bundles')
    const token =
      core.getInput('token') ||
      core.getInput('github_token') ||
      process.env.GITHUB_TOKEN

    if (!token) {
      core.setFailed('❌ A token is required to execute this action')
      return
    }

    const bundlePaths: string[] = []
    for (const checkPath of inputPaths) {
      try {
        await stat(checkPath)
        bundlePaths.push(checkPath)
      } catch (error) {
        core.error((error as Error).message)
      }
    }
    let bundlePath = path.join(os.tmpdir(), 'Merged.xcresult')
    if (inputPaths.length > 1) {
      await mergeResultBundle(bundlePaths, bundlePath)
    } else {
      const inputPath = inputPaths[0]
      await stat(inputPath)
      bundlePath = inputPath
    }

    const formatter = new Formatter(bundlePath)
    const report = await formatter.format({
      showPassedTests,
      showCodeCoverage
    })

    const charactersLimit = 65535
    let title = core.getInput('title')
    if (title.length > charactersLimit) {
      core.warning(
        `The 'title' will be truncated because the character limit (${charactersLimit}) exceeded.`
      )
      title = title.substring(0, charactersLimit)
    }
    const output = generateOutput(report)

    core.info(`Setting output: ${JSON.stringify(report.stats, null, 2)}`)
    core.setOutput('failed_tests', report.stats?.failed ?? 0)
    core.setOutput('passed_tests', report.stats?.passed ?? 0)
    core.setOutput('skipped_tests', report.stats?.skipped ?? 0)
    core.setOutput('total_tests', report.stats?.total ?? 0)

    if (core.getBooleanInput('create-job-summary')) {
      core.info('Creating job summary')
      await core.summary.addHeading(output.title).addRaw(output.summary).write()
      for (const annotation of report.annotations) {
        const properties: core.AnnotationProperties = {
          title: annotation.title,
          file: annotation.path,
          startLine: annotation.start_line,
          endLine: annotation.end_line,
          startColumn: annotation.start_column,
          endColumn: annotation.end_column
        }
        if (annotation.annotation_level === 'failure') {
          core.error(annotation.message, properties)
        } else if (annotation.annotation_level === 'warning') {
          core.warning(annotation.message, properties)
        } else {
          core.notice(annotation.message, properties)
        }
      }

      if (report.testStatus === 'failure') {
        core.setFailed(`❌ Tests reported ${report.stats?.failed} failures`)
      }
    }

    if (core.getBooleanInput('create-check')) {
      core.info('Creating job check')
      const octokit = new Octokit()

      const pr = github.context.payload.pull_request
      const sha = (pr && pr.head.sha) || github.context.sha

      await octokit.checks.create({
        ...github.context.repo,
        name: title,
        head_sha: sha,
        status: 'completed',
        conclusion: report.testStatus,
        output
      })
    }

    if (uploadBundles) {
      for (const uploadBundlePath of inputPaths) {
        try {
          await stat(uploadBundlePath)
        } catch (error) {
          continue
        }

        const artifactClient = artifact.create()
        const artifactName = path.basename(uploadBundlePath)

        const rootDirectory = uploadBundlePath
        const options = {
          continueOnError: false
        }

        glob(`${uploadBundlePath}/**/*`, async (error, files) => {
          if (error) {
            core.error(error)
          }
          if (files.length) {
            await artifactClient.uploadArtifact(
              artifactName,
              files,
              rootDirectory,
              options
            )
          }
        })
      }
    }

    core.debug(JSON.stringify(report.stats, null, 2))
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}

run()

async function mergeResultBundle(
  inputPaths: string[],
  outputPath: string
): Promise<void> {
  const args = ['xcresulttool', 'merge']
    .concat(inputPaths)
    .concat(['--output-path', outputPath])
  const options = {
    silent: true
  }

  await exec.exec('xcrun', args, options)
}

function generateOutput(report: TestReport): ReportOutput {
  const charactersLimit = 65535
  let reportSummary = report.reportSummary
  if (reportSummary.length > charactersLimit) {
    core.warning(
      `The 'summary' will be truncated because the character limit (${charactersLimit}) exceeded.`
    )
    reportSummary = reportSummary.substring(0, charactersLimit)
  }
  let reportDetail = report.reportDetail
  if (reportDetail.length > charactersLimit) {
    core.warning(
      `The 'text' will be truncated because the character limit (${charactersLimit}) exceeded.`
    )
    reportDetail = reportDetail.substring(0, charactersLimit)
  }

  if (report.annotations.length > 50) {
    core.warning('Annotations that exceed the limit (50) will be truncated.')
  }
  const annotations = report.annotations.slice(0, 50)
  let output
  if (reportDetail.trim()) {
    output = {
      title: 'Xcode test results',
      summary: reportSummary,
      text: reportDetail,
      annotations
    }
  } else {
    output = {
      title: 'Xcode test results',
      summary: reportSummary,
      annotations
    }
  }

  return output
}
