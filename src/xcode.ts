import * as core from '@actions/core'
import * as exec from '@actions/exec'

export async function getXcodeVersion(): Promise<number> {
  let output = ''
  const options = {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      }
    },
    silent: !core.isDebug()
  }
  await exec.exec('xcodebuild', ['-version'], options)
  const match = output.match(/Xcode (\d+)/)
  if (match) {
    return parseInt(match[1], 10)
  } else {
    core.warning(
      `Failed to determine Xcode version from command 'xcodebuild -version'.`
    )
    core.info(output)
    return 0
  }
}
