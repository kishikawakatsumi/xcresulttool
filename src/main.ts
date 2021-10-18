// import * as artifact from '@actions/artifact'
import * as core from '@actions/core'
// import * as exec from '@actions/exec'
// import * as github from '@actions/github'
// import {Octokit} from '@octokit/action'
import * as formatter from './formatter'
import * as fs from 'fs'
// import * as parser from './parser'

/*eslint-disable @typescript-eslint/no-explicit-any */
async function run(): Promise<void> {
  try {
    const bundlePath: string = core.getInput('xcresult')
    const formatted = await formatter.format(bundlePath)
    fs.writeFile('report.md', formatted.join('\n'), () => {})
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
