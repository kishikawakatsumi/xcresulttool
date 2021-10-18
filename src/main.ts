// import * as artifact from '@actions/artifact'
import * as core from '@actions/core'
import * as github from '@actions/github'
import {Octokit} from '@octokit/action'
import * as formatter from './formatter'

/*eslint-disable @typescript-eslint/no-explicit-any */
async function run(): Promise<void> {
  try {
    const bundlePath: string = core.getInput('xcresult')
    const formatted = await formatter.format(bundlePath)

    const octokit = new Octokit()

    const owner = github.context.repo.owner
    const repo = github.context.repo.repo

    let sha = github.context.sha
    const pr = github.context.payload.pull_request
    if (pr && pr.head.sha) {
      sha = pr.head.sha
    }

    await octokit.checks.create({
      owner: owner,
      repo: repo,
      name: 'Xcode test results',
      status: 'completed',
      conclusion: 'neutral',
      head_sha: sha,
      output: {
        title: 'Xcode test results',
        summary: formatted.join('\n'),
        annotations: []
      }
    })
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
