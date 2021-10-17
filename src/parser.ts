import * as fs from 'fs/promises'
import * as exec from '@actions/exec'

export async function parse(
  bundlePath: string,
  reference?: string
): Promise<any> {
  const root = JSON.parse(await toJSON(bundlePath, reference))
  return parseObject(root) as any
}

function parseObject(obj: object): object {
  const o: any = {}

  Object.entries(obj).forEach(([key, value]: [string, any]) => {
    if (value['_value']) {
      o[key] = parsePrimitive(value)
    } else if (value['_values']) {
      o[key] = parseArray(value)
    } else if (key === '_type') {
      return
    } else {
      o[key] = parseObject(value)
    }
  })

  return o
}

function parseArray(value: any): any {
  return value['_values'].map((value: object) => {
    const obj: any = {}
    Object.entries(value).forEach(([key, value]: [string, any]) => {
      if (value['_value']) {
        obj[key] = parsePrimitive(value)
      } else if (value['_values']) {
        obj[key] = parseArray(value)
      } else if (key === '_type') {
        return
      } else if (key === '_value') {
        return
      } else {
        obj[key] = parseObject(value)
      }
    })
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
): Promise<string> {
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
  return Buffer.from(await fs.readFile(outputPath)).toString('base64')
}
