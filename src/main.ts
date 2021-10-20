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
const {stat} = promises

async function run(): Promise<void> {
  try {
    const inputPath: string = core.getInput('path')

    const paths = inputPath.split('\n')
    const existPaths: string[] = []
    for (const checkPath of paths) {
      try {
        await stat(checkPath)
        existPaths.push(checkPath)
      } catch (error) {
        core.error((error as Error).message)
      }
    }
    let bundlePath = path.join(os.tmpdir(), 'Merged.xcresult')
    if (paths.length > 1) {
      await mergeResultBundle(existPaths, bundlePath)
    } else {
      await stat(inputPath)
      bundlePath = inputPath
    }

    const formatter = new Formatter(bundlePath)
    const report = await formatter.format()

    if (core.getInput('token')) {
      const octokit = new Octokit()

      const owner = github.context.repo.owner
      const repo = github.context.repo.repo

      const pr = github.context.payload.pull_request
      const sha = (pr && pr.head.sha) || github.context.sha

      const title = core.getInput('title')
      await octokit.checks.create({
        owner,
        repo,
        name: title,
        head_sha: sha,
        status: 'completed',
        conclusion: report.annotations.length ? 'failure' : 'success',
        output: {
          title: 'Xcode test results',
          summary: report.reportSummary,
          text: report.reportDetail,
          annotations: report.annotations
        }
      })

      for (const uploadBundlePath of paths) {
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
