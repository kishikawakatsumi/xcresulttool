import * as artifact from '@actions/artifact'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import {Formatter} from './formatter'
import {Octokit} from '@octokit/action'

async function run(): Promise<void> {
  try {
    const bundlePath: string = core.getInput('xcresult')
    const formatter = new Formatter(bundlePath)
    const report = await formatter.format()

    core.info(process.env.GITHUB_WORKSPACE || '')
    core.info(bundlePath)
    core.debug(process.env.GITHUB_WORKSPACE || '')
    core.debug(bundlePath)
    core.error(process.env.GITHUB_WORKSPACE || '')
    core.error(bundlePath)

    if (core.getInput('GITHUB_TOKEN')) {
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
        conclusion: 'neutral',
        output: {
          title: 'Xcode test results',
          summary: report.reportSummary,
          text: report.reportDetail,
          annotations: report.annotations
        }
      })

      const artifactClient = artifact.create()
      const artifactName = path.basename(bundlePath)
      const files = [bundlePath]

      const rootDirectory = '.'
      const options = {
        continueOnError: false
      }

      await artifactClient.uploadArtifact(
        artifactName,
        files,
        rootDirectory,
        options
      )
    }
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}

run()
