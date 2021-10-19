/*eslint-disable @typescript-eslint/no-explicit-any */
import * as exec from '@actions/exec'
import {promises} from 'fs'
const {readFile} = promises

export async function parse(
  bundlePath: string,
  reference?: string
): Promise<any> {
  const root = JSON.parse(await toJSON(bundlePath, reference))
  return parseObject(root) as any
}

function parseObject(obj: object): object {
  const o: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value['_value']) {
      o[key] = parsePrimitive(value)
    } else if (value['_values']) {
      o[key] = parseArray(value)
    } else if (key === '_type') {
      continue
    } else {
      o[key] = parseObject(value)
    }
  }

  return o
}

function parseArray(value: any): any {
  return value['_values'].map((val: object) => {
    const obj: any = {}
    for (const [k, v] of Object.entries(val)) {
      if (v['_value']) {
        obj[k] = parsePrimitive(v)
      } else if (v['_values']) {
        obj[k] = parseArray(v)
      } else if (k === '_type') {
        continue
      } else if (k === '_value') {
        continue
      } else {
        obj[k] = parseObject(v)
      }
    }
    return obj
  })
}

function parsePrimitive(object: any): any {
  switch (object['_type']['_name']) {
    case 'Int':
      return parseInt(object['_value'])
    case 'Double':
      return parseFloat(object['_value'])
    default:
      return object['_value']
  }
}

async function toJSON(bundlePath: string, reference?: string): Promise<string> {
  const args = ['xcresulttool', 'get', '--path', bundlePath, '--format', 'json']
  if (reference) {
    args.push('--id')
    args.push(reference)
  }

  let output = ''
  const options = {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      }
    }
  }

  await exec.exec('xcrun', args, options)
  return output
}

export async function exportObject(
  bundlePath: string,
  reference: string,
  outputPath: string
): Promise<Buffer> {
  const args = [
    'xcresulttool',
    'export',
    '--type',
    'file',
    '--path',
    bundlePath,
    '--output-path',
    outputPath,
    '--id',
    reference
  ]
  const options = {
    silent: true
  }

  await exec.exec('xcrun', args, options)
  return Buffer.from(await readFile(outputPath))
}
