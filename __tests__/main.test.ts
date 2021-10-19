import {expect, test} from '@jest/globals'
import * as cp from 'child_process'
import {promises} from 'fs'
const {readFile, writeFile} = promises
import * as os from 'os'
import * as path from 'path'
import * as process from 'process'
import * as formatter from '../src/formatter'

test('example.xcresult', async () => {
  const bundlePath = '__tests__/data/example.xcresult'
  const formatted = await formatter.format(bundlePath)

  const outputPath = path.join(os.tmpdir(), 'example.md')
  await writeFile(outputPath, formatted.join('\n'))
  expect((await readFile(outputPath)).toString()).toBe(
    (await readFile('__tests__/data/example.md')).toString()
  )
})

test('KeychainAccess.xcresult', async () => {
  const bundlePath = '__tests__/data/KeychainAccess.xcresult'
  const formatted = await formatter.format(bundlePath)

  const outputPath = path.join(os.tmpdir(), 'KeychainAccess.md')
  await writeFile(outputPath, formatted.join('\n'))
  expect((await readFile(outputPath)).toString()).toBe(
    (await readFile('__tests__/data/KeychainAccess.md')).toString()
  )
})

test('TAU.xcresult', async () => {
  const bundlePath = '__tests__/data/TAU.xcresult'
  const formatted = await formatter.format(bundlePath)

  const outputPath = path.join(os.tmpdir(), 'TAU.md')
  await writeFile(outputPath, formatted.join('\n'))
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
