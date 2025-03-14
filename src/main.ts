import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as path from 'path'
import * as fs from 'fs'

async function run(): Promise<void> {
  try {
    // Get inputs from the action
    const inputPaths = core.getMultilineInput('path')
    const showPassedTests = core.getBooleanInput('show-passed-tests')
    const showCodeCoverage = core.getBooleanInput('show-code-coverage')
    const token = core.getInput('token')
    const title = core.getInput('title')
    const uploadBundles = core.getInput('upload-bundles').toLowerCase()
    
    // Validate inputs
    if (inputPaths.length === 0) {
      core.setFailed('No xcresult paths provided')
      return
    }
    
    // Check if paths exist
    const validPaths: string[] = []
    for (const inputPath of inputPaths) {
      if (fs.existsSync(inputPath)) {
        validPaths.push(inputPath)
      } else {
        core.warning(`Path does not exist: ${inputPath}`)
      }
    }
    
    if (validPaths.length === 0) {
      core.setFailed('No valid xcresult paths found')
      return
    }
    
    // Get the path to our CLI
    const cliPath = path.join(__dirname, 'cli.js')
    
    // Make sure the CLI is executable
    fs.chmodSync(cliPath, '755')
    
    // For each valid path, run the CLI
    for (const xcresultPath of validPaths) {
      core.info(`Processing xcresult: ${xcresultPath}`)
      
      // Build CLI arguments
      const args = [
        cliPath,
        '--path', xcresultPath,
        '--show-passed-tests', showPassedTests.toString(),
        '--show-code-coverage', showCodeCoverage.toString(),
        '--github-action' // Special flag to indicate we're running in GitHub Actions
      ]
      
      // Run the CLI and capture output
      let stdout = ''
      let stderr = ''
      
      const options = {
        listeners: {
          stdout: (data: Buffer) => {
            stdout += data.toString()
          },
          stderr: (data: Buffer) => {
            stderr += data.toString()
          }
        }
      }
      
      const exitCode = await exec.exec('node', args, options)
      
      if (exitCode !== 0) {
        core.error(`CLI failed with exit code ${exitCode}`)
        core.error(stderr)
        core.setFailed('Failed to process xcresult')
        return
      }
      
      // Add the output to the GitHub Actions summary
      await core.summary.addRaw(stdout).write()
      
      // If token is provided, create a check run
      if (token) {
        // Extract the summary and details from the CLI output
        // This assumes our CLI outputs in a specific format we can parse
        const summaryMatch = stdout.match(/# Test Results Summary\n\n([\s\S]*?)(?=\n# |$)/)
        const detailsMatch = stdout.match(/# Test Details\n\n([\s\S]*?)(?=\n# |$)/)
        
        const summary = summaryMatch ? summaryMatch[1] : 'No test summary available'
        const details = detailsMatch ? detailsMatch[1] : 'No test details available'
        
        // Determine test status from summary
        const failedMatch = summary.match(/Failed tests: (\d+)/)
        const failedCount = failedMatch ? parseInt(failedMatch[1]) : 0
        const testStatus = failedCount > 0 ? 'failure' : 'success'
        
        // Create GitHub check
        const github = require('@actions/github')
        const octokit = github.getOctokit(token)
        
        const owner = github.context.repo.owner
        const repo = github.context.repo.repo
        
        const pr = github.context.payload.pull_request
        const sha = (pr && pr.head.sha) || github.context.sha
        
        await octokit.rest.checks.create({
          owner,
          repo,
          name: title,
          head_sha: sha,
          status: 'completed',
          conclusion: testStatus,
          output: {
            title: 'Xcode Test Results',
            summary,
            text: details
          }
        })
      }
      
      // Handle bundle uploads if requested
      if (uploadBundles === 'always' || 
          (uploadBundles === 'failure' && stdout.includes('Failed tests: ') && !stdout.includes('Failed tests: 0'))) {
        core.info(`Uploading xcresult bundle: ${xcresultPath}`)
        
        const artifact = require('@actions/artifact')
        const artifactClient = artifact.create()
        const artifactName = path.basename(xcresultPath)
        
        // We need to list all files in the xcresult bundle
        const { glob } = require('glob')
        const files = await glob(`${xcresultPath}/**/*`)
        
        if (files.length > 0) {
          await artifactClient.uploadArtifact(
            artifactName,
            files,
            xcresultPath,
            { continueOnError: false }
          )
        }
      }
    }
    
  } catch (error) {
    core.setFailed((error as Error).message)
  }
}

run()
