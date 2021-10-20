import * as artifact from '@actions/artifact'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import {Formatter} from './formatter'
import {Octokit} from '@octokit/action'
import {glob} from 'glob'
import {promises} from 'fs'
const {stat} = promises

async function run(): Promise<void> {
  try {
    const bundlePath: string = core.getInput('path')
    try {
      await stat(bundlePath)
    } catch (error) {
      core.error((error as Error).message)
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

      const artifactClient = artifact.create()
      const artifactName = path.basename(bundlePath)

      const rootDirectory = bundlePath
      const options = {
        continueOnError: false
      }

      glob(`${bundlePath}/**/*`, async (error, files) => {
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
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}

run()
