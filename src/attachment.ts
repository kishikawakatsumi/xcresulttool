import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as os from 'os'
import * as path from 'path'

import {Activity} from './activity'
import {Dimensions} from './dimensions'
import {Parser} from './parser'

import {Reference} from '../dev/@types/Reference.d'
import {SortedKeyValueArray} from '../dev/@types/SortedKeyValueArray.d'

import sizeOf from 'image-size'

export interface Attachment {
  uniformTypeIdentifier: string
  name?: string
  uuid?: string
  timestamp?: string
  userInfo?: SortedKeyValueArray
  lifetime: string
  inActivityIdentifier: number
  filename?: string
  payloadRef?: Reference
  payloadSize: number
  link: string
  dimensions: Dimensions
}

export async function exportAttachments(
  parser: Parser,
  activity: Activity
): Promise<void> {
  activity.attachments = activity.attachments || []

  if (activity.attachments) {
    for (const attachment of activity.attachments) {
      if (attachment.filename && attachment.payloadRef) {
        const outputPath = path.join(os.tmpdir(), attachment.filename)
        const image = await parser.exportObject(
          attachment.payloadRef.id,
          outputPath
        )

        let output = ''
        const options = {
          silent: true,
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString()
            }
          }
        }

        try {
          const dimensions: Dimensions = sizeOf(image)
          attachment.dimensions = dimensions

          if (image && core.getInput('token')) {
            await exec.exec(
              'curl',
              [
                '-X',
                'POST',
                'https://xcresulttool-file.herokuapp.com/file',
                '-d',
                image.toString('base64')
              ],
              options
            )
            const response = JSON.parse(output)
            if (response) {
              attachment.link = response.link
            }
          }
        } catch (error) {
          core.notice(error as Error)
        }
      }
    }
  }
}
