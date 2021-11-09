import * as path from 'path'

const baseUrl = 'https://xcresulttool-static.netlify.app/i/'
const attrs = 'width="14px" align="top"'

export function testStatus(statusText: string): string {
  let filename = ''
  switch (statusText) {
    case 'Success':
      filename = 'passed.png'
      break
    case 'Failure':
      filename = 'failure.png'
      break
    case 'Skipped':
      filename = 'skipped.png'
      break
    case 'Mixed Success':
      filename = 'mixed-passed.png'
      break
    case 'Mixed Failure':
      filename = 'mixed-failure.png'
      break
    case 'Expected Failure':
      filename = 'expected-failure.png'
      break
    default:
      filename = 'unknown.png'
      break
  }
  return `<img src="${baseUrl}${filename}" alt="${statusText}" title="${statusText}" ${attrs}>`
}

export function icon(filename: string): string {
  const alt = path.parse(filename).name
  return `<img src="${baseUrl}${filename}" alt="${alt}" ${attrs}>`
}
