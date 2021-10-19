import * as cp from 'child_process'
import * as os from 'os'
import * as path from 'path'
import * as process from 'process'
import {expect, test} from '@jest/globals'
import {promises} from 'fs'
const {readFile, writeFile} = promises
import {Formatter} from '../src/formatter'

test('example.xcresult', async () => {
  const bundlePath = '__tests__/data/example.xcresult'
  const formatter = new Formatter(bundlePath)
  const report = await formatter.format()
  const reportText = `${report.reportSummary}\n${report.reportDetail}`

  const outputPath = path.join(os.tmpdir(), 'example.md')
  await writeFile(outputPath, reportText)
  // await writeFile('example.md', reportText)
  expect((await readFile(outputPath)).toString()).toBe(
    (await readFile('__tests__/data/example.md')).toString()
  )
})

test('KeychainAccess.xcresult', async () => {
  const bundlePath = '__tests__/data/KeychainAccess.xcresult'
  const formatter = new Formatter(bundlePath)
  const report = await formatter.format()
  const reportText = `${report.reportSummary}\n${report.reportDetail}`

  const outputPath = path.join(os.tmpdir(), 'KeychainAccess.md')
  await writeFile(outputPath, reportText)
  // await writeFile('KeychainAccess.md', reportText)
  expect((await readFile(outputPath)).toString()).toBe(
    (await readFile('__tests__/data/KeychainAccess.md')).toString()
  )
})

test('TAU.xcresult', async () => {
  const bundlePath = '__tests__/data/TAU.xcresult'
  const formatter = new Formatter(bundlePath)
  const report = await formatter.format()
  const reportText = `${report.reportSummary}\n${report.reportDetail}`

  const outputPath = path.join(os.tmpdir(), 'TAU.md')
  await writeFile(outputPath, reportText)
  // await writeFile('TAU.md', reportText)
  expect((await readFile(outputPath)).toString()).toBe(
    (await readFile('__tests__/data/TAU.md')).toString()
  )
})

test('test runs', () => {
  process.env['INPUT_XCRESULT'] = '__tests__/data/example.xcresult'
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }
  console.log(cp.execFileSync(np, [ip], options).toString())
})
