/*eslint-disable no-shadow */

import * as Image from './image'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as os from 'os'
import * as path from 'path'

import {ActionTestActivitySummary} from '../dev/@types/ActionTestActivitySummary.d'
import {ActionTestFailureSummary} from '../dev/@types/ActionTestFailureSummary.d'
import {ActionTestMetadata} from '../dev/@types/ActionTestMetadata.d'
import {ActionTestPlanRunSummaries} from '../dev/@types/ActionTestPlanRunSummaries.d'
import {ActionTestSummary} from '../dev/@types/ActionTestSummary.d'
import {ActionTestSummaryGroup} from '../dev/@types/ActionTestSummaryGroup.d'
import {ActionTestSummaryIdentifiableObject} from '../dev/@types/ActionTestSummaryIdentifiableObject.d'
import {ActionTestableSummary} from '../dev/@types/ActionTestableSummary.d'
import {ActionsInvocationMetadata} from '../dev/@types/ActionsInvocationMetadata.d'
import {ActionsInvocationRecord} from '../dev/@types/ActionsInvocationRecord.d'
import {Parser} from './parser'
import {Reference} from '../dev/@types/Reference.d'
import {SortedKeyValueArray} from '../dev/@types/SortedKeyValueArray.d'

import sizeOf from 'image-size'

const passedIcon = Image.testStatus('Success')
const failedIcon = Image.testStatus('Failure')
const skippedIcon = Image.testStatus('Skipped')
const expectedFailureIcon = Image.testStatus('Expected Failure')

const backIcon = Image.icon('right-arrow-curving-left.png')
const testClassIcon = Image.icon('test-class.png')
const testMethodIcon = Image.icon('test-method.png')
const attachmentIcon = Image.icon('attachment.png')

type actionTestSummary =
  | ActionTestSummaryIdentifiableObject
  | ActionTestSummaryGroup
  | ActionTestSummary
  | ActionTestMetadata

type actionTestSummaries = actionTestSummary[]

class TestReportSection {
  readonly summary: ActionTestableSummary
  readonly details: actionTestSummaries

  constructor(summary: ActionTestableSummary, details: actionTestSummaries) {
    this.summary = summary
    this.details = details
  }
}

export async function format(bundlePath: string): Promise<string[]> {
  const parser = new Parser(bundlePath)

  const actionsInvocationRecord: ActionsInvocationRecord = await parser.parse()

  const lines: string[] = []
  const testReport: {[key: string]: TestReportSection} = {}
  let entityName = ''

  if (actionsInvocationRecord.metadataRef) {
    const metadata: ActionsInvocationMetadata = await parser.parse(
      actionsInvocationRecord.metadataRef.id
    )
    if (metadata.schemeIdentifier) {
      const schemeIdentifier = metadata.schemeIdentifier
      entityName = schemeIdentifier.entityName
    }
  }

  if (actionsInvocationRecord.actions) {
    for (const action of actionsInvocationRecord.actions) {
      const schemeCommandName = action.schemeCommandName

      lines.push(`### ${schemeCommandName} ${entityName}\n`)

      if (action.actionResult) {
        if (action.actionResult.testsRef) {
          const actionTestPlanRunSummaries: ActionTestPlanRunSummaries =
            await parser.parse(action.actionResult.testsRef.id)

          for (const summary of actionTestPlanRunSummaries.summaries) {
            for (const testableSummary of summary.testableSummaries) {
              const testSummaries: actionTestSummaries = []
              await collectTestSummaries(
                parser,
                testableSummary,
                testableSummary.tests,
                testSummaries
              )
              if (testableSummary.name) {
                testReport[testableSummary.name] = new TestReportSection(
                  testableSummary,
                  testSummaries
                )
              }
            }
          }
        }
      }
    }
  }

  class TestSummaryStats {
    passed = 0
    failed = 0
    skipped = 0
    expectedFailure = 0
    total = 0
  }
  type TestSummaryStatsGroup = {[key: string]: TestSummaryStats}
  const testSummary = {
    stats: new TestSummaryStats(),
    duration: 0,
    groups: {} as {[key: string]: TestSummaryStatsGroup}
  }
  for (const [identifier, results] of Object.entries(testReport)) {
    const detailGroup = results.details.reduce(
      (groups: {[key: string]: actionTestSummaries}, detail) => {
        const d = detail as actionTestSummary & {group?: string}
        if (d.group) {
          if (groups[d.group]) {
            groups[d.group].push(detail)
          } else {
            groups[d.group] = [detail]
          }
        }
        return groups
      },
      {}
    )

    const group: TestSummaryStatsGroup = {}
    for (const [identifier, details] of Object.entries(detailGroup)) {
      const [stats, duration] = details.reduce(
        ([stats, duration]: [TestSummaryStats, number], detail) => {
          const test = detail as ActionTestSummary
          switch (test.testStatus) {
            case 'Success':
              stats.passed++
              break
            case 'Failure':
              stats.failed++
              break
            case 'Skipped':
              stats.skipped++
              break
            case 'Expected Failure':
              stats.expectedFailure++
              break
          }

          stats.total++

          if (test.duration) {
            duration = test.duration
          }
          return [stats, duration]
        },
        [new TestSummaryStats(), 0]
      )
      testSummary.stats.passed += stats.passed
      testSummary.stats.failed += stats.failed
      testSummary.stats.skipped += stats.skipped
      testSummary.stats.expectedFailure += stats.expectedFailure
      testSummary.stats.total += stats.total
      testSummary.duration += duration

      group[identifier] = {
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped,
        expectedFailure: stats.expectedFailure,
        total: stats.total
      }
    }

    const groups = testSummary.groups
    groups[identifier] = group
  }

  lines.push('### Summary')

  lines.push('<table>')
  lines.push('<thead><tr>')
  const header = [
    `<th>Total</th>`,
    `<th>${passedIcon}&nbsp;Passed</th>`,
    `<th>${failedIcon}&nbsp;Failed</th>`,
    `<th>${skippedIcon}&nbsp;Skipped</th>`,
    `<th>${expectedFailureIcon}&nbsp;Expected Failure</th>`,
    `<th>:stopwatch:&nbsp;Time</th>`
  ].join('')
  lines.push(header)
  lines.push('</tr></thead>')

  lines.push('<tbody><tr>')

  let failedCount: string
  if (testSummary.stats.failed > 0) {
    failedCount = `<b>${testSummary.stats.failed}</b>`
  } else {
    failedCount = `${testSummary.stats.failed}`
  }
  const duration = testSummary.duration.toFixed(2)
  const cols = [
    `<td align="right" width="118px">${testSummary.stats.total}</td>`,
    `<td align="right" width="118px">${testSummary.stats.passed}</td>`,
    `<td align="right" width="118px">${failedCount}</td>`,
    `<td align="right" width="118px">${testSummary.stats.skipped}</td>`,
    `<td align="right" width="158px">${testSummary.stats.expectedFailure}</td>`,
    `<td align="right" width="138px">${duration}s</td>`
  ].join('')
  lines.push(cols)
  lines.push('</tr></tbody>')
  lines.push('</table>\n')

  lines.push('---')
  lines.push('')

  lines.push('### Test Summary')

  for (const [groupIdentifier, group] of Object.entries(testSummary.groups)) {
    const anchorName = anchorIdentifier(groupIdentifier)
    lines.push(
      `#### <a name="${groupIdentifier}_summary"></a>[${groupIdentifier}](${anchorName})`
    )
    lines.push('')

    lines.push('<table>')
    lines.push('<thead><tr>')
    const header = [
      `<th>Test</th>`,
      `<th>Total</th>`,
      `<th>${passedIcon}</th>`,
      `<th>${failedIcon}</th>`,
      `<th>${skippedIcon}</th>`,
      `<th>${expectedFailureIcon}</th>`
    ].join('')
    lines.push(header)
    lines.push('</tr></thead>')

    lines.push('<tbody>')
    for (const [identifier, stats] of Object.entries(group)) {
      lines.push('<tr>')
      const testClass = `${testClassIcon}&nbsp;${identifier}`
      const testClassAnchor = `<a name="${groupIdentifier}_${identifier}_summary"></a>`
      const anchorName = anchorIdentifier(`${groupIdentifier}_${identifier}`)
      const testClassLink = `<a href="${anchorName}">${testClass}</a>`

      let failedCount: string
      if (stats.failed > 0) {
        failedCount = `<b>${stats.failed}</b>`
      } else {
        failedCount = `${stats.failed}`
      }
      const cols = [
        `<td align="left" width="368px">${testClassAnchor}${testClassLink}</td>`,
        `<td align="right" width="80px">${stats.total}</td>`,
        `<td align="right" width="80px">${stats.passed}</td>`,
        `<td align="right" width="80px">${failedCount}</td>`,
        `<td align="right" width="80px">${stats.skipped}</td>`,
        `<td align="right" width="80px">${stats.expectedFailure}</td>`
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

  for (const [, results] of Object.entries(testReport)) {
    const testDetail = new TestDetail()
    testDetails.details.push(testDetail)

    const testResultSummaryName = results.summary.name
    const anchorName = anchorIdentifier(`${testResultSummaryName}_summary`)
    testDetail.lines.push(
      `#### <a name="${testResultSummaryName}"></a>${testResultSummaryName}[${backIcon}](${anchorName})`
    )
    testDetail.lines.push('')

    const detailGroup = results.details.reduce(
      (groups: {[key: string]: actionTestSummaries}, detail) => {
        const d = detail as actionTestSummary & {group?: string}
        if (d.group) {
          if (groups[d.group]) {
            groups[d.group].push(detail)
          } else {
            groups[d.group] = [detail]
          }
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
            detail
          ) => {
            const test = detail as ActionTestSummary
            switch (test.testStatus) {
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

            if (test.duration) {
              duration = test.duration
            }
            return [passed, failed, skipped, expectedFailure, total, duration]
          },
          [0, 0, 0, 0, 0, 0]
        )

      const testName = `${groupIdentifier}`
      const passedRate = ((passed / total) * 100).toFixed(0)
      const failedRate = ((failed / total) * 100).toFixed(0)
      const skippedRate = ((skipped / total) * 100).toFixed(0)
      const expectedFailureRate = ((expectedFailure / total) * 100).toFixed(0)
      const testDuration = duration.toFixed(2)

      const anchor = `<a name="${testResultSummaryName}_${groupIdentifier}"></a>`
      const anchorName = anchorIdentifier(
        `${testResultSummaryName}_${groupIdentifier}_summary`
      )
      const anchorBack = `[${backIcon}](${anchorName})`
      testDetail.lines.push(`${anchor}<h5>${testName}&nbsp;${anchorBack}</h5>`)

      const testsStatsLines: string[] = []

      testsStatsLines.push('<table>')
      testsStatsLines.push('<thead><tr>')
      const header = [
        `<th>${passedIcon}</th>`,
        `<th>${failedIcon}</th>`,
        `<th>${skippedIcon}</th>`,
        `<th>${expectedFailureIcon}</th>`,
        `<th>:stopwatch:</th>`
      ].join('')
      testsStatsLines.push(header)
      testsStatsLines.push('</tr></thead>')

      testsStatsLines.push('<tbody>')

      testsStatsLines.push('<tr>')

      let failedCount: string
      if (failed > 0) {
        failedCount = `<b>${failed} (${failedRate}%)</b>`
      } else {
        failedCount = `${failed} (${failedRate}%)`
      }
      const cols = [
        `<td align="right" width="154px">${passed} (${passedRate}%)</td>`,
        `<td align="right" width="154px">${failedCount}</td>`,
        `<td align="right" width="154px">${skipped} (${skippedRate}%)</td>`,
        `<td align="right" width="154px">${expectedFailure} (${expectedFailureRate}%)</td>`,
        `<td align="right" width="154px">${testDuration}s</td>`
      ].join('')
      testsStatsLines.push(cols)
      testsStatsLines.push('</tr>')

      testsStatsLines.push('</tbody>')
      testsStatsLines.push('</table>\n')

      testDetail.lines.push(testsStatsLines.join('\n'))

      const testDetailTable: string[] = []
      testDetailTable.push(`<table>`)

      const configurationGroup = details.reduce(
        (groups: {[key: string]: actionTestSummaries}, detail) => {
          if (detail.identifier) {
            if (groups[detail.identifier]) {
              groups[detail.identifier].push(detail)
            } else {
              groups[detail.identifier] = [detail]
            }
          }
          return groups
        },
        {}
      )

      for (const [, details] of Object.entries(configurationGroup)) {
        const statuses = details.map(detail => {
          const test = detail as ActionTestSummary
          return test.testStatus
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
        const groupStatusImage = Image.testStatus(groupStatus)

        for (const [index, detail] of details.entries()) {
          const testResult = detail as ActionTestMetadata
          const rowSpan = `rowspan="${details.length}"`
          const valign = `valign="top"`
          const colWidth = 'width="52px"'
          const detailWidth = 'width="716px"'

          const status = Image.testStatus(testResult.testStatus)
          const resultLines: string[] = []

          if (testResult.summaryRef) {
            const summary: ActionTestSummary = await parser.parse(
              testResult.summaryRef.id
            )

            const testFailureGroup = new TestFailureGroup(
              testResultSummaryName || '',
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

            if (summary.configuration) {
              if (testResult.name) {
                const isFailure = testResult.testStatus === 'Failure'
                const testMethodAnchor = isFailure
                  ? `<a name="${testResultSummaryName}_${testResult.identifier}"></a>`
                  : ''
                const backAnchorName = anchorIdentifier(
                  `${testResultSummaryName}_${testResult.identifier}_failure-summary`
                )
                const backAnchorLink = isFailure
                  ? `<a href="${backAnchorName}">${backIcon}</a>`
                  : ''
                const testMethod = `${testMethodAnchor}${testMethodIcon}&nbsp;<code>${testResult.name}</code>${backAnchorLink}`
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
                const isFailure = testResult.testStatus === 'Failure'
                const testMethodAnchor = isFailure
                  ? `<a name="${testResultSummaryName}_${testResult.identifier}"></a>`
                  : ''
                const backAnchorName = anchorIdentifier(
                  `${testResultSummaryName}_${testResult.identifier}_failure-summary`
                )
                const backAnchorLink = isFailure
                  ? `<a href="${backAnchorName}">${backIcon}</a>`
                  : ''
                const testMethod = `${testMethodAnchor}${testMethodIcon}&nbsp;<code>${testResult.name}</code>${backAnchorLink}`
                resultLines.push(`${testMethod}`)
              }
            }

            const activities: Activity[] = []
            if (summary.activitySummaries) {
              await collectActivities(
                parser,
                summary.activitySummaries,
                activities
              )
            }
            if (activities.length) {
              const testActivities = activities
                .map(activity => {
                  const attachments = activity.attachments.map(attachment => {
                    let width = '100%'
                    const dimensions = attachment.dimensions
                    if (dimensions.width && dimensions.height) {
                      if (
                        dimensions.orientation &&
                        dimensions.orientation >= 5
                      ) {
                        width = `${dimensions.height}px`
                      } else {
                        width = `${dimensions.width}px`
                      }
                    }

                    const userInfo = attachment.userInfo
                    if (userInfo) {
                      for (const info of userInfo.storage) {
                        if (info.key === 'Scale') {
                          const scale = parseInt(`${info.value}`)
                          if (dimensions.width && dimensions.height) {
                            if (
                              dimensions.orientation &&
                              dimensions.orientation >= 5
                            ) {
                              width = `${(dimensions.height / scale).toFixed(
                                0
                              )}px`
                            } else {
                              width = `${(dimensions.width / scale).toFixed(
                                0
                              )}px`
                            }
                          } else {
                            width = `${(100 / scale).toFixed(0)}%`
                          }
                        }
                      }
                    }

                    const widthAttr = `width="${width}"`
                    return `<div><img ${widthAttr} src="${attachment.link}"></div>`
                  })

                  if (attachments.length) {
                    const testStatus = testResult.testStatus
                    const open = testStatus.includes('Failure') ? 'open' : ''
                    const title = escapeHashSign(activity.title)
                    const message = `${indentation(activity.indent)}- ${title}`
                    const attachmentIndent = indentation(activity.indent + 1)
                    const attachmentContent = attachments.join('')
                    return `${message}\n${attachmentIndent}<details ${open}><summary>${attachmentIcon}</summary>${attachmentContent}</details>`
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
              const isFailure = testResult.testStatus === 'Failure'
              const testMethodAnchor = isFailure
                ? `<a name="${testResultSummaryName}_${testResult.identifier}"></a>`
                : ''
              const backAnchorName = anchorIdentifier(
                `${testResultSummaryName}_${testResult.identifier}_failure-summary`
              )
              const backAnchorLink = isFailure
                ? `<a href="${backAnchorName}">${backIcon}</a>`
                : ''
              const testMethod = `${testMethodAnchor}${testMethodIcon}&nbsp;<code>${testResult.name}</code>${backAnchorLink}`
              resultLines.push(`${testMethod}`)
            }
          }

          const testResultContent = resultLines.join('<br>')
          let testResultRow = ''
          if (details.length > 1) {
            if (index === 0) {
              testResultRow = `<tr><td align="center" ${rowSpan} ${valign} ${colWidth}>${groupStatusImage}</td><td ${valign} ${detailWidth}>${testResultContent}</td></tr>`
            } else {
              testResultRow = `<tr><td ${valign} ${detailWidth}>${testResultContent}</td></tr>`
            }
          } else {
            testResultRow = `<tr><td align="center" ${valign} ${colWidth}>${status}</td><td ${valign} ${detailWidth}>${testResultContent}</td></tr>`
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
      if (failureGroup.failures.length) {
        const anchorName = anchorIdentifier(
          `${failureGroup.summaryIdentifier}_${failureGroup.identifier}`
        )
        const testMethodLink = `<a name="${failureGroup.summaryIdentifier}_${failureGroup.identifier}_failure-summary"></a><a href="${anchorName}">${failureGroup.identifier}</a>`
        lines.push(`<h4>${testMethodLink}</h4>`)
        for (const failure of failureGroup.failures) {
          for (const line of failure.lines) {
            lines.push(line)
          }
        }
      }
    }
  }

  lines.push('')
  lines.push(testDetails.header)
  for (const testDetail of testDetails.details) {
    for (const detail of testDetail.lines) {
      lines.push(detail)
    }
  }

  return lines
}

async function collectTestSummaries(
  parser: Parser,
  group: ActionTestableSummary | ActionTestSummaryGroup,
  tests: actionTestSummaries,
  testSummaries: actionTestSummaries
): Promise<void> {
  for (const test of tests) {
    if (test.hasOwnProperty('subtests')) {
      const group = test as ActionTestSummaryGroup
      await collectTestSummaries(parser, group, group.subtests, testSummaries)
    } else {
      const t = test as actionTestSummary & {group?: string}
      t.group = group.name
      testSummaries.push(test)
    }
  }
}

async function collectActivities(
  parser: Parser,
  activitySummaries: ActionTestActivitySummary[],
  activities: Activity[],
  indent = 0
): Promise<void> {
  for (const activitySummary of activitySummaries) {
    const activity = activitySummary as Activity
    activity.indent = indent
    await exportAttachments(parser, activity)
    activities.push(activity)

    if (activitySummary.subactivities) {
      await collectActivities(
        parser,
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
    const lineNumber = location?.lineNumber

    const titleAlign = 'align="right"'
    const titleWidth = 'width="100px"'
    const titleAttr = `${titleAlign} ${titleWidth}`
    const detailWidth = 'width="668px"'
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
    return {contents, stackTrace: stackTrace || []} as FailureSummary
  })
}

async function exportAttachments(
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

          if (image && core.getInput('GITHUB_TOKEN')) {
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
          core.error(error as Error)
        }
      }
    }
  }
}

class TestFailures {
  failureGroups: TestFailureGroup[] = []
}

class TestFailureGroup {
  summaryIdentifier: string
  identifier: string
  name: string

  failures: TestFailure[] = []

  constructor(summaryIdentifier: string, identifier: string, name: string) {
    this.summaryIdentifier = summaryIdentifier
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
  dimensions: Dimensions
}

interface Dimensions {
  width: number | undefined
  height: number | undefined
  orientation?: number
  type?: string
}

interface FailureSummary {
  contents: string
  stackTrace: string
}

function indentation(level: number): string {
  return '  '.repeat(level)
}

function anchorIdentifier(text: string): string {
  return `#user-content-${text.toLowerCase()}`
}

function escapeHashSign(text: string): string {
  return text.replace(/#/g, '<span>#</span>')
}
