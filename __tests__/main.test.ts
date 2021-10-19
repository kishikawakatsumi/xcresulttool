import * as cp from 'child_process'
import * as formatter from '../src/formatter'
import * as os from 'os'
import * as path from 'path'
import * as process from 'process'
import {expect, test} from '@jest/globals'
import {promises} from 'fs'
const {readFile, writeFile} = promises

test('example.xcresult', async () => {
  const bundlePath = '__tests__/data/example.xcresult'
  const formatted = await formatter.format(bundlePath)

  const outputPath = path.join(os.tmpdir(), 'example.md')
  await writeFile(outputPath, formatted)
  // await writeFile('example.md', formatted)
  expect((await readFile(outputPath)).toString()).toBe(
    (await readFile('__tests__/data/example.md')).toString()
  )
})

test('KeychainAccess.xcresult', async () => {
  const bundlePath = '__tests__/data/KeychainAccess.xcresult'
  const formatted = await formatter.format(bundlePath)

  const outputPath = path.join(os.tmpdir(), 'KeychainAccess.md')
  await writeFile(outputPath, formatted)
  // await writeFile('KeychainAccess.md', formatted)
  expect((await readFile(outputPath)).toString()).toBe(
    (await readFile('__tests__/data/KeychainAccess.md')).toString()
  )
})

test('TAU.xcresult', async () => {
  const bundlePath = '__tests__/data/TAU.xcresult'
  const formatted = await formatter.format(bundlePath)

  const outputPath = path.join(os.tmpdir(), 'TAU.md')
  await writeFile(outputPath, formatted)
  // await writeFile('TAU.md', formatted)
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
