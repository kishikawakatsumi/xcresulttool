import * as exec from "@actions/exec";

export async function getXcodeVersion(): Promise<number> {
    let output = '';
    const options = {
        listeners: {
            stdout: (data: Buffer) => {
                output += data.toString();
            }
        }
    };
    await exec.exec('xcodebuild', ['-version'], options);
    const match = output.match(/Xcode (\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }
    throw new Error('Unable to determine Xcode version');
}