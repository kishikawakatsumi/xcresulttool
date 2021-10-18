/*eslint-disable @typescript-eslint/no-explicit-any,no-console,no-shadow,object-shorthand,@typescript-eslint/no-unused-vars */
import * as exec from '@actions/exec'
import * as os from 'os'
import * as parser from './parser'
import * as path from 'path'

import {ActionTestActivitySummary} from './types/ActionTestActivitySummary'
import {ActionTestFailureSummary} from './types/ActionTestFailureSummary'
import {ActionTestMetadata} from './types/ActionTestMetadata'
import {ActionTestPlanRunSummaries} from './types/ActionTestPlanRunSummaries'
import {ActionTestSummary} from './types/ActionTestSummary'
import {ActionTestSummaryGroup} from './types/ActionTestSummaryGroup'
import {ActionTestSummaryIdentifiableObject} from './types/ActionTestSummaryIdentifiableObject'
import {ActionsInvocationMetadata} from './types/ActionsInvocationMetadata'
import {ActionsInvocationRecord} from './types/ActionsInvocationRecord'
// import {ActivityLogSection} from '../types/ActivityLogSection.d'
import {Reference} from './types/Reference'
import {SortedKeyValueArray} from './types/SortedKeyValueArray'

export async function format(bundlePath: string): Promise<string[]> {
  const actionsInvocationRecord: ActionsInvocationRecord = await parser.parse(
    bundlePath
  )

  const lines: string[] = []
  const testReport: any = {}
  let entityName = ''

  console.log('=== actionsInvocationRecord ===')
  console.log(actionsInvocationRecord)

  if (actionsInvocationRecord.metadataRef) {
    const metadata: ActionsInvocationMetadata = await parser.parse(
      bundlePath,
      actionsInvocationRecord.metadataRef.id
    )
    if (metadata.schemeIdentifier) {
      const schemeIdentifier = metadata.schemeIdentifier
      entityName = schemeIdentifier.entityName
    }
  }

  if (actionsInvocationRecord.actions) {
    console.log('=== actions ===')
    for (const action of actionsInvocationRecord.actions) {
      const schemeCommandName = action.schemeCommandName

      // const title = action.title
      // const startedTime = action.startedTime
      // const endedTime = action.endedTime

      lines.push(`### ${schemeCommandName} ${entityName}\n`)

      // console.log(action.runDestination)
      // const displayName = action.runDestination.displayName

      if (action.actionResult) {
        console.log('=== actionResult ===')
        console.log(action.actionResult)
        if (action.actionResult.testsRef) {
          const actionTestPlanRunSummaries: ActionTestPlanRunSummaries =
            await parser.parse(bundlePath, action.actionResult.testsRef.id)
          console.log('=== actionTestPlanRunSummaries ===')

          for (const summary of actionTestPlanRunSummaries.summaries) {
            for (const testableSummary of summary.testableSummaries) {
              const testResults: ActionTestMetadata[] = []
              await collectTestResults(
                bundlePath,
                testableSummary as any,
                testableSummary.tests,
                testResults
              )
              if (testableSummary.name) {
                testReport[testableSummary.name] = {
                  summary: testableSummary,
                  details: testResults
                }
              }
            }
          }
        }
        // if (action.actionResult.logRef) {
        //   const activityLogSection: ActivityLogSection = await parser.parse(
        //     bundlePath,
        //     action.actionResult.logRef.id
        //   )
        //   console.log('=== log ===')
        //   console.log('activityLogSection')
        // }
      }
      // if (action.buildResult) {
      //   console.log('=== buildResult ===')
      //   console.log(action.buildResult)
      //   if (action.buildResult.logRef) {
      //     const activityLogSection: ActivityLogSection = await parser.parse(
      //       bundlePath,
      //       action.buildResult.logRef.id
      //     )
      //     console.log('=== log ===')
      //     console.log('activityLogSection')
      //   }
      // }
    }
  }

  if (actionsInvocationRecord.issues.testFailureSummaries) {
    console.log('=== testFailureSummaries ===')
    for (const testFailureSummary of actionsInvocationRecord.issues
      .testFailureSummaries) {
      console.log(testFailureSummary)
    }
  }

  const testSummary = {
    passed: 0,
    failed: 0,
    skipped: 0,
    expectedFailure: 0,
    total: 0,
    duration: 0,
    groups: {}
  }
  for (const [identifier, results] of Object.entries(testReport)) {
    const details: ActionTestMetadata[] = (results as any)['details']
    const detailGroup = details.reduce(
      (groups: {[key: string]: ActionTestMetadata[]}, detail) => {
        const group: string = (detail as any)['group']
        if (groups[group]) {
          groups[group].push(detail)
        } else {
          groups[group] = [detail]
        }
        return groups
      },
      {}
    )

    const group: any = {}
    for (const [identifier, details] of Object.entries(detailGroup)) {
      const [passed, failed, skipped, expectedFailure, total, duration] =
        details.reduce(
          (
            [passed, failed, skipped, expectedFailure, total, duration]: [
              number,
              number,
              number,
              number,
              number,
              number
            ],
            metadata
          ) => {
            switch (metadata.testStatus) {
              case 'Success':
                passed++
                break
              case 'Failure':
                failed++
                break
              case 'Skipped':
                skipped++
                break
              case 'Expected Failure':
                expectedFailure++
                break
            }

            total++

            if (metadata.duration) {
              duration = metadata.duration
            }
            return [passed, failed, skipped, expectedFailure, total, duration]
          },
          [0, 0, 0, 0, 0, 0]
        )
      testSummary.passed += passed
      testSummary.failed += failed
      testSummary.skipped += skipped
      testSummary.expectedFailure += expectedFailure
      testSummary.total += total
      testSummary.duration += duration

      group[identifier] = {
        passed: passed,
        failed: failed,
        skipped: skipped,
        expectedFailure: expectedFailure,
        total: total
      }
    }

    const groups: any = testSummary.groups
    groups[identifier] = group
  }

  lines.push('### Summary')
  const passedImage = statusImage('Success')
  const failedImage = statusImage('Failure')
  const skippedImage = statusImage('Skipped')
  const expectedFailureImage = statusImage('Expected Failure')

  lines.push('<table>')
  lines.push('<thead><tr>')
  const header = [
    `<th>Total</th>`,
    `<th>${passedImage} Passed</th>`,
    `<th>${failedImage} Failed</th>`,
    `<th>${skippedImage} Skipped</th>`,
    `<th>${expectedFailureImage} Expected Failure</th>`,
    `<th>:stopwatch: Time</th>`
  ].join('')
  lines.push(header)
  lines.push('</tr></thead>')

  lines.push('<tbody><tr>')
  const duration = testSummary.duration.toFixed(2)
  const cols = [
    `<td align="right" width="150px">${testSummary.total}</td>`,
    `<td align="right" width="150px">${testSummary.passed}</td>`,
    `<td align="right" width="150px">${testSummary.failed}</td>`,
    `<td align="right" width="150px">${testSummary.skipped}</td>`,
    `<td align="right" width="200px">${testSummary.expectedFailure}</td>`,
    `<td align="right" width="150px">${duration}s</td>`
  ].join('')
  lines.push(cols)
  lines.push('</tr></tbody>')
  lines.push('</table>\n')

  lines.push('---')
  lines.push('')

  lines.push('### Test Summary')

  for (const [groupIdentifier, group] of Object.entries(testSummary.groups)) {
    lines.push(
      `#### <a name="${groupIdentifier}_summary">[${groupIdentifier}](#${groupIdentifier})`
    )
    lines.push('')

    lines.push('<table>')
    lines.push('<thead><tr>')
    const header = [
      `<th>Test</th>`,
      `<th>Total</th>`,
      `<th>${passedImage} Passed</th>`,
      `<th>${failedImage} Failed</th>`,
      `<th>${skippedImage} Skipped</th>`,
      `<th>${expectedFailureImage} Expected Failure</th>`
    ].join('')
    lines.push(header)
    lines.push('</tr></thead>')

    lines.push('<tbody>')
    for (const [identifier, detail] of Object.entries(group as any)) {
      lines.push('<tr>')
      const test: any = detail
      const testClass = `${remoteImage('test-class.png')} ${identifier}`
      const testClassAnchor = `<a name="${groupIdentifier}_${identifier}_summary"></a>`
      const testClassLink = `<a href="#${groupIdentifier}_${identifier}">${testClass}</a>`

      const cols = [
        `<td align="left" width="280px">${testClassAnchor}${testClassLink}</td>`,
        `<td align="right" width="100px">${test.total}</td>`,
        `<td align="right" width="100px">${test.passed}</td>`,
        `<td align="right" width="100px">${test.failed}</td>`,
        `<td align="right" width="120px">${test.skipped}</td>`,
        `<td align="right" width="180px">${test.expectedFailure}s</td>`
      ].join('')
      lines.push(cols)
      lines.push('</tr>')
    }
    lines.push('</tbody>')
    lines.push('</table>\n')
  }
  lines.push('')

  lines.push('---')
  lines.push('')

  const testFailures = new TestFailures()
  const testDetails = new TestDetails()

  for (const [identifier, results] of Object.entries(testReport)) {
    const testDetail = new TestDetail()
    testDetails.details.push(testDetail)

    const name = (results as any)['summary']['name']
    const backImage = remoteImage('right-arrow-curving-left.png')
    testDetail.lines.push(
      `#### <a name="${name}"></a>${name}[${backImage}](#${name}_summary)`
    )
    testDetail.lines.push('')

    const details: ActionTestMetadata[] = (results as any)['details']

    const detailGroup = details.reduce(
      (groups: {[key: string]: ActionTestMetadata[]}, detail) => {
        const group: string = (detail as any)['group']
        if (groups[group]) {
          groups[group].push(detail)
        } else {
          groups[group] = [detail]
        }
        return groups
      },
      {}
    )

    for (const [identifier, details] of Object.entries(detailGroup)) {
      const groupIdentifier = identifier

      const [passed, failed, skipped, expectedFailure, total, duration] =
        details.reduce(
          (
            [passed, failed, skipped, expectedFailure, total, duration]: [
              number,
              number,
              number,
              number,
              number,
              number
            ],
            metadata
          ) => {
            switch (metadata.testStatus) {
              case 'Success':
                passed++
                break
              case 'Failure':
                failed++
                break
              case 'Skipped':
                skipped++
                break
              case 'Expected Failure':
                expectedFailure++
                break
            }

            total++

            if (metadata.duration) {
              duration = metadata.duration
            }
            return [passed, failed, skipped, expectedFailure, total, duration]
          },
          [0, 0, 0, 0, 0, 0]
        )

      const testName = `${groupIdentifier} ${name}`
      const passedRate = ((passed / total) * 100).toFixed(0)
      const failedRate = ((failed / total) * 100).toFixed(0)
      const skippedRate = ((skipped / total) * 100).toFixed(0)
      const expectedFailureRate = ((expectedFailure / total) * 100).toFixed(0)
      const anchor = `<a name="${name}_${groupIdentifier}"></a>`

      const testsStatsLines: string[] = []
      if (passed) {
        testsStatsLines.push(`${passed} passed (${passedRate}%)`)
      }
      if (failed) {
        testsStatsLines.push(`${failed} failed (${failedRate}%)`)
      }
      if (skipped) {
        testsStatsLines.push(`${skipped} skipped (${skippedRate}%)`)
      }
      if (expectedFailure) {
        testsStatsLines.push(
          `${expectedFailure} expected failure (${expectedFailureRate}%)`
        )
      }
      const testDuration = duration.toFixed(2)
      const arrowImage = remoteImage('right-arrow-curving-left.png')
      const anchorBack = `[${arrowImage}](#${name}_${groupIdentifier}_summary)`
      const testStats = testsStatsLines.join(', ')
      testDetail.lines.push(
        `${anchor}<span>${testName} ${testStats} in ${testDuration}s</span> ${anchorBack}\n`
      )

      const testDetailTable: string[] = []
      testDetailTable.push(`<table>`)

      const configurationGroup = details.reduce(
        (groups: {[key: string]: ActionTestMetadata[]}, metadata) => {
          if (metadata.identifier) {
            if (groups[metadata.identifier]) {
              groups[metadata.identifier].push(metadata)
            } else {
              groups[metadata.identifier] = [metadata]
            }
          }
          return groups
        },
        {}
      )

      for (const [identifier, details] of Object.entries(configurationGroup)) {
        const statuses = details.map(detail => {
          return detail.testStatus
        })
        let groupStatus = ''
        if (statuses.length) {
          if (statuses.every(status => status === 'Success')) {
            groupStatus = 'Success'
          } else if (statuses.every(status => status === 'Failure')) {
            groupStatus = 'Failure'
          } else if (statuses.every(status => status === 'Skipped')) {
            groupStatus = 'Skipped'
          } else if (statuses.every(status => status === 'Expected Failure')) {
            groupStatus = 'Expected Failure'
          } else {
            if (
              statuses
                .filter(status => status !== 'Skipped')
                .some(status => status === 'Failure')
            ) {
              groupStatus = 'Mixed Failure'
            } else if (
              statuses
                .filter(status => status !== 'Skipped')
                .filter(status => status !== 'Expected Failure')
                .every(status => status === 'Success')
            ) {
              groupStatus = 'Mixed Success'
            } else {
              groupStatus = 'Expected Failure'
            }
          }
        }
        const groupStatusImage = statusImage(groupStatus)

        for (const [index, detail] of details.entries()) {
          const testResult = detail
          const rowSpan = `rowspan="${details.length}"`
          const valign = `valign="top"`
          const colWidth = 'width="52px"'
          const detailWidth = 'width="716px"'

          const status = statusImage(testResult.testStatus)
          const resultLines: string[] = []

          if (testResult.summaryRef) {
            const summary: ActionTestSummary = await parser.parse(
              bundlePath,
              testResult.summaryRef.id
            )

            const testFailureGroup = new TestFailureGroup(
              summary.identifier || '',
              summary.name || ''
            )
            testFailures.failureGroups.push(testFailureGroup)

            if (summary.failureSummaries) {
              const testFailure = new TestFailure()
              testFailureGroup.failures.push(testFailure)

              const failureSummaries = collectFailureSummaries(
                summary.failureSummaries
              )
              for (const failureSummary of failureSummaries) {
                testFailure.lines.push(`${failureSummary.contents}`)
              }
            }
            if (summary.expectedFailures) {
              console.log('summary.expectedFailures')
              console.log(summary.expectedFailures)
            }

            if (summary.configuration) {
              if (testResult.name) {
                const testMethodImage = remoteImage('test-method.png')
                const testMethod = `${testMethodImage} <code>${testResult.name}</code>`
                resultLines.push(`${status} ${testMethod}`)
              }
              const configuration = summary.configuration
              const configurationValues = configuration.values.storage
                .map(value => {
                  return `${value.key}: ${value.value}`
                })
                .join(', ')

              resultLines.push(
                `<br><b>Configuration:</b><br><code>${configurationValues}</code>`
              )
            } else {
              if (testResult.name) {
                const testMethodImage = remoteImage('test-method.png')
                const testMethod = `${testMethodImage} <code>${testResult.name}</code>`
                resultLines.push(`${testMethod}`)
              }
            }

            const activities: Activity[] = []
            if (summary.activitySummaries) {
              await collectActivities(
                bundlePath,
                summary.activitySummaries,
                activities
              )
            }
            if (activities.length) {
              const testActivities = activities
                .map(activity => {
                  const attachments = activity.attachments.map(attachment => {
                    return `<div><img src="${attachment.link}"></div>`
                  })

                  if (attachments.length) {
                    const testStatus = testResult.testStatus
                    const open = testStatus.includes('Failure') ? 'open' : ''
                    const title = escapeHashSign(activity.title)
                    const message = `${indentation(activity.indent)}- ${title}`
                    const attachmentIndent = indentation(activity.indent + 1)
                    const attachmentContent = attachments.join('')
                    return `${message}\n${attachmentIndent}<details ${open}><summary>:paperclip:</summary>${attachmentContent}</details>`
                  } else {
                    const indent = indentation(activity.indent)
                    return `${indent}- ${escapeHashSign(activity.title)}`
                  }
                })
                .join('\n')

              resultLines.push(`<br><b>Activities:</b>\n\n${testActivities}`)
            }
          } else {
            if (testResult.name) {
              const testMethodImage = remoteImage('test-method.png')
              const testMethod = `${testMethodImage} <code>${testResult.name}</code>`
              resultLines.push(`${testMethod}`)
            }
          }

          const testResultContent = resultLines.join('<br>')
          let testResultRow = ''
          if (details.length > 1) {
            if (index === 0) {
              testResultRow = `<tr><td ${rowSpan} ${valign} ${colWidth}>${groupStatusImage}</td><td ${valign} ${detailWidth}>${testResultContent}</td></tr>`
            } else {
              testResultRow = `<tr><td ${valign} ${detailWidth}>${testResultContent}</td></tr>`
            }
          } else {
            testResultRow = `<tr><td ${valign} ${colWidth}>${status}</td><td ${valign} ${detailWidth}>${testResultContent}</td></tr>`
          }
          testDetailTable.push(testResultRow)
        }
      }

      testDetailTable.push(`</table>`)
      testDetailTable.push('')

      testDetail.lines.push(testDetailTable.join('\n'))
    }
  }

  if (testFailures.failureGroups.length) {
    lines.push('### Failures')
    for (const failureGroup of testFailures.failureGroups) {
      const testMethodImage = remoteImage('test-method.png')
      lines.push(`<h4>${failureGroup.identifier}</h4>`)
      for (const failure of failureGroup.failures) {
        for (const line of failure.lines) {
          lines.push(line)
        }
      }
    }
  }

  lines.push(testDetails.header)
  for (const testDetail of testDetails.details) {
    for (const detail of testDetail.lines) {
      lines.push(detail)
    }
  }

  return lines
}

async function collectTestResults(
  bundlePath: string,
  group: ActionTestSummaryGroup,
  testSummaries: ActionTestSummaryIdentifiableObject[],
  testResults: ActionTestSummaryIdentifiableObject[]
): Promise<void> {
  for (const test of testSummaries) {
    if (test.hasOwnProperty('subtests')) {
      const group = test as ActionTestSummaryGroup
      await collectTestResults(bundlePath, group, group.subtests, testResults)
    } else {
      const obj: any = test
      obj['group'] = group.name
      if (test.hasOwnProperty('summaryRef')) {
        const metadata = test as ActionTestMetadata
        testResults.push(metadata)
      } else {
        testResults.push(test)
      }
    }
  }
}

async function collectActivities(
  bundlePath: string,
  activitySummaries: ActionTestActivitySummary[],
  activities: Activity[],
  indent = 0
): Promise<void> {
  for (const activitySummary of activitySummaries) {
    const activity = activitySummary as Activity
    activity.indent = indent
    await exportAttachments(bundlePath, activity)
    activities.push(activity)

    if (activitySummary.subactivities) {
      await collectActivities(
        bundlePath,
        activitySummary.subactivities,
        activities,
        indent + 1
      )
    }
  }
}

function collectFailureSummaries(
  failureSummaries: ActionTestFailureSummary[]
): FailureSummary[] {
  return failureSummaries.map(failureSummary => {
    const sourceCodeContext = failureSummary.sourceCodeContext
    const callStack = sourceCodeContext?.callStack
    const location = sourceCodeContext?.location
    const filePath = location?.filePath
    const lineNumber = location?.lineNumber

    const titleAlign = 'align="right"'
    const titleWidth = 'width="120px"'
    const titleAttr = `${titleAlign} ${titleWidth}`
    const detailWidth = 'width="780px"'
    const contents =
      '<table>' +
      `<tr><td ${titleAttr}><b>File</b></td><td ${detailWidth}>${failureSummary.fileName}:${lineNumber}</td></tr>` +
      `<tr><td ${titleAttr}><b>Issue Type</b></td><td ${detailWidth}>${failureSummary.issueType}</td></tr>` +
      `<tr><td ${titleAttr}><b>Message</b></td><td ${detailWidth}>${failureSummary.message}</td></tr>` +
      `</table>\n`

    const stackTrace = callStack
      ?.map((callStack, index) => {
        const addressString = callStack.addressString
        const symbolInfo = callStack.symbolInfo
        const imageName = symbolInfo?.imageName || ''
        const symbolName = symbolInfo?.symbolName || ''
        const location = symbolInfo?.location
        const filePath = location?.filePath
        const lineNumber = location?.lineNumber
        const seq = `${index}`.padEnd(2, ' ')
        return `${seq} ${imageName} ${addressString} ${symbolName} ${filePath}: ${lineNumber}`
      })
      .join('\n')
    return {contents: contents, stackTrace: stackTrace || []} as FailureSummary
  })
}

async function exportAttachments(
  bundlePath: string,
  activity: Activity
): Promise<void> {
  activity.attachments = activity.attachments || []

  if (activity.attachments) {
    for (const attachment of activity.attachments) {
      if (attachment.filename && attachment.payloadRef) {
        const outputPath = path.join(os.tmpdir(), attachment.filename)
        const image = await parser.exportObject(
          bundlePath,
          attachment.payloadRef.id,
          outputPath
        )

        let output = ''
        const options = {
          silent: false,
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString()
            }
          }
        }

        try {
          await exec.exec(
            'curl',
            [
              '-X',
              'POST',
              'https://xcresulttool-file.herokuapp.com/file',
              '-d',
              image
            ],
            options
          )
          const response = JSON.parse(output)
          if (response) {
            attachment.link = response.link
          }
        } catch (error) {
          console.log(error)
        }
      }
    }
  }
}

class TestFailures {
  failureGroups: TestFailureGroup[] = []
}

class TestFailureGroup {
  identifier: string
  name: string

  failures: TestFailure[] = []

  constructor(identifier: string, name: string) {
    this.identifier = identifier
    this.name = name
  }
}

class TestFailure {
  lines: string[] = []
}

class TestDetails {
  header = '### Test Details\n'
  details: TestDetail[] = []
}

class TestDetail {
  lines: string[] = []
}

interface Activity {
  title: string
  activityType: string
  uuid: string
  start?: string
  finish?: string
  attachments: Attachment[]
  subactivities: ActionTestActivitySummary[]
  failureSummaryIDs: string[]
  expectedFailureIDs: string[]
  indent: number
}

interface Attachment {
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
}

interface FailureSummary {
  contents: string
  stackTrace: string
}

function indentation(level: number): string {
  return '  '.repeat(level)
}

function statusImage(statusText: string): string {
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
  const baseUrl = 'https://xcresulttool-resources.netlify.app/images/'
  const attrs = 'width="14px" align="top"'
  return `<img src="${baseUrl}${filename}" ${attrs}>`
}

function remoteImage(filename: string): string {
  const baseUrl = 'https://xcresulttool-resources.netlify.app/images/'
  const attrs = 'width="14px" align="top"'
  return `<img src="${baseUrl}${filename}" ${attrs}>`
}

function escapeHashSign(text: string): string {
  return text.replace(/#/g, '<span>#</span>')
}
