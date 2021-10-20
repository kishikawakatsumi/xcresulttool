import * as cp from 'child_process'
import * as os from 'os'
import * as path from 'path'
import * as process from 'process'
import {expect, test} from '@jest/globals'
import {promises} from 'fs'
const {readFile, writeFile} = promises
import {Formatter} from '../src/formatter'

test('test runs', () => {
  process.env['INPUT_PATH'] = '__tests__/data/Example.xcresult'
  const np = process.execPath
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecFileSyncOptions = {
    env: process.env
  }
})
