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

    if (core.getInput('GITHUB_TOKEN')) {
      const octokit = new Octokit()

      const owner = github.context.repo.owner
      const repo = github.context.repo.repo

      let sha = github.context.sha
      const pr = github.context.payload.pull_request
      if (pr && pr.head.sha) {
        sha = pr.head.sha
      }

      const title = core.getInput('title')
      await octokit.checks.create({
        owner,
        repo,
        name: title,
        status: 'completed',
        conclusion: 'neutral',
        head_sha: sha,
        output: {
          title: 'Xcode test results',
          summary: report.reportSummary,
          text: report.reportDetail,
          annotations: []
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
