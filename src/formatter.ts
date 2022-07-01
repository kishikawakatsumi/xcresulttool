/*eslint-disable no-shadow */

import * as Image from './image'
import * as github from '@actions/github'
import * as path from 'path'

import {
  Annotation,
  BuildLog,
  TestCodeCoverage,
  TestDetail,
  TestDetails,
  TestFailure,
  TestFailureGroup,
  TestFailures,
  TestReport,
  TestReportChapter,
  TestReportChapterDetail,
  TestReportChapterSummary,
  TestReportSection,
  actionTestSummaries,
  actionTestSummary
} from './report'
import {
  anchorIdentifier,
  anchorNameTag,
  escapeHashSign,
  indentation
} from './markdown'

import {ActionTestActivitySummary} from '../dev/@types/ActionTestActivitySummary.d'
import {ActionTestFailureSummary} from '../dev/@types/ActionTestFailureSummary.d'
import {ActionTestMetadata} from '../dev/@types/ActionTestMetadata.d'
import {ActionTestPlanRunSummaries} from '../dev/@types/ActionTestPlanRunSummaries.d'
import {ActionTestSummary} from '../dev/@types/ActionTestSummary.d'
import {ActionTestSummaryGroup} from '../dev/@types/ActionTestSummaryGroup.d'
import {ActionTestableSummary} from '../dev/@types/ActionTestableSummary.d'
import {ActionsInvocationMetadata} from '../dev/@types/ActionsInvocationMetadata.d'
import {ActionsInvocationRecord} from '../dev/@types/ActionsInvocationRecord.d'

import {Activity} from './activity'
import {ActivityLogSection} from '../dev/@types/ActivityLogSection.d'
import {Convert} from './coverage'
import {Parser} from './parser'
import {exportAttachments} from './attachment'

const passedIcon = Image.testStatus('Success')
const failedIcon = Image.testStatus('Failure')
const skippedIcon = Image.testStatus('Skipped')
const expectedFailureIcon = Image.testStatus('Expected Failure')

const backIcon = Image.icon('back.png')
const testClassIcon = Image.icon('test-class.png')
const testMethodIcon = Image.icon('test-method.png')
const attachmentIcon = Image.icon('attachment.png')

export class TestSummaryStats {
  passed = 0
  failed = 0
  skipped = 0
  expectedFailure = 0
  total = 0
}

export class Formatter {
  readonly summaries = ''
  readonly details = ''

  private bundlePath: string
  private parser: Parser

  constructor(bundlePath: string) {
    this.bundlePath = bundlePath
    this.parser = new Parser(this.bundlePath)
  }

  async format(
    options: FormatterOptions = new FormatterOptions()
  ): Promise<TestReport> {
    const actionsInvocationRecord: ActionsInvocationRecord =
      await this.parser.parse()

    const testReport = new TestReport()

    if (actionsInvocationRecord.metadataRef) {
      const metadata: ActionsInvocationMetadata = await this.parser.parse(
        actionsInvocationRecord.metadataRef.id
      )

      testReport.entityName = metadata.schemeIdentifier?.entityName
      testReport.creatingWorkspaceFilePath = metadata.creatingWorkspaceFilePath
    }

    if (actionsInvocationRecord.actions) {
      for (const action of actionsInvocationRecord.actions) {
        if (action.buildResult.logRef) {
          const log: ActivityLogSection = await this.parser.parse(
            action.buildResult.logRef.id
          )
          const buildLog = new BuildLog(
            log,
            testReport.creatingWorkspaceFilePath
          )
          if (buildLog.content.length) {
            testReport.buildLog = buildLog
            testReport.testStatus = 'failure'
            for (const annotation of buildLog.annotations) {
              testReport.annotations.push(annotation)
            }
          }
        }
        if (action.actionResult) {
          if (action.actionResult.testsRef) {
            const testReportChapter = new TestReportChapter(
              action.schemeCommandName,
              action.runDestination,
              action.title
            )
            testReport.chapters.push(testReportChapter)

            const actionTestPlanRunSummaries: ActionTestPlanRunSummaries =
              await this.parser.parse(action.actionResult.testsRef.id)

            for (const summary of actionTestPlanRunSummaries.summaries) {
              for (const testableSummary of summary.testableSummaries) {
                const testSummaries: actionTestSummaries = []
                await this.collectTestSummaries(
                  testableSummary,
                  testableSummary.tests,
                  testSummaries
                )
                if (testableSummary.name) {
                  testReportChapter.sections[testableSummary.name] =
                    new TestReportSection(testableSummary, testSummaries)
                }
              }
            }

            if (action.actionResult.coverage) {
              try {
                const codeCoverage = Convert.toCodeCoverage(
                  await this.parser.exportCodeCoverage()
                )

                const testCodeCoverage = new TestCodeCoverage(codeCoverage)
                testReport.codeCoverage = testCodeCoverage
              } catch (error) {
                // no-op
              }
            }
          }
        }
      }
    }

    type TestSummaryStatsGroup = {[key: string]: TestSummaryStats}
    const testSummary = {
      stats: new TestSummaryStats(),
      duration: 0,
      groups: {} as {[key: string]: TestSummaryStatsGroup}
    }

    for (const chapter of testReport.chapters) {
      const chapterSummary = new TestReportChapterSummary()
      chapter.summaries.push(chapterSummary)

      for (const [identifier, results] of Object.entries(chapter.sections)) {
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
              if (test.testStatus) {
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
              }

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

      chapterSummary.content.push('### Summary')

      chapterSummary.content.push('<table>')
      chapterSummary.content.push('<tr>')
      const header = [
        `<th>Total`,
        `<th>${passedIcon}&nbsp;Passed`,
        `<th>${failedIcon}&nbsp;Failed`,
        `<th>${skippedIcon}&nbsp;Skipped`,
        `<th>${expectedFailureIcon}&nbsp;Expected Failure`,
        `<th>:stopwatch:&nbsp;Time`
      ].join('')
      chapterSummary.content.push(header)

      chapterSummary.content.push('<tr>')

      let failedCount: string
      if (testSummary.stats.failed > 0) {
        failedCount = `<b>${testSummary.stats.failed}</b>`
      } else {
        failedCount = `${testSummary.stats.failed}`
      }
      const duration = testSummary.duration.toFixed(2)
      const cols = [
        `<td align="right" width="118px">${testSummary.stats.total}`,
        `<td align="right" width="118px">${testSummary.stats.passed}`,
        `<td align="right" width="118px">${failedCount}`,
        `<td align="right" width="118px">${testSummary.stats.skipped}`,
        `<td align="right" width="158px">${testSummary.stats.expectedFailure}`,
        `<td align="right" width="138px">${duration}s`
      ].join('')
      chapterSummary.content.push(cols)
      chapterSummary.content.push('</table>\n')

      chapterSummary.content.push('---\n')

      if (testSummary.stats.failed > 0) {
        testReport.testStatus = 'failure'
      } else if (testSummary.stats.passed > 0) {
        testReport.testStatus = 'success'
      }

      testReport.stats = testSummary.stats

      chapterSummary.content.push('### Test Summary')

      for (const [groupIdentifier, group] of Object.entries(
        testSummary.groups
      )) {
        const anchorName = anchorIdentifier(groupIdentifier)
        const anchorTag = anchorNameTag(`${groupIdentifier}_summary`)
        chapterSummary.content.push(
          `#### ${anchorTag}[${groupIdentifier}](${anchorName})\n`
        )

        const runDestination = chapter.runDestination
        chapterSummary.content.push(
          `- **Device:** ${runDestination.targetDeviceRecord.modelName}, ${runDestination.targetDeviceRecord.operatingSystemVersionWithBuildNumber}`
        )
        chapterSummary.content.push(
          `- **SDK:** ${runDestination.targetSDKRecord.name}, ${runDestination.targetSDKRecord.operatingSystemVersion}`
        )

        chapterSummary.content.push('<table>')
        chapterSummary.content.push('<tr>')
        const header = [
          `<th>Test`,
          `<th>Total`,
          `<th>${passedIcon}`,
          `<th>${failedIcon}`,
          `<th>${skippedIcon}`,
          `<th>${expectedFailureIcon}`
        ].join('')
        chapterSummary.content.push(header)

        for (const [identifier, stats] of Object.entries(group)) {
          chapterSummary.content.push('<tr>')
          const testClass = `${testClassIcon}&nbsp;${identifier}`
          const testClassAnchor = anchorNameTag(
            `${groupIdentifier}_${identifier}_summary`
          )
          const anchorName = anchorIdentifier(
            `${groupIdentifier}_${identifier}`
          )
          const testClassLink = `<a href="${anchorName}">${testClass}</a>`

          let failedCount: string
          if (stats.failed > 0) {
            failedCount = `<b>${stats.failed}</b>`
          } else {
            failedCount = `${stats.failed}`
          }
          const cols = [
            `<td align="left" width="368px">${testClassAnchor}${testClassLink}`,
            `<td align="right" width="80px">${stats.total}`,
            `<td align="right" width="80px">${stats.passed}`,
            `<td align="right" width="80px">${failedCount}`,
            `<td align="right" width="80px">${stats.skipped}`,
            `<td align="right" width="80px">${stats.expectedFailure}`
          ].join('')
          chapterSummary.content.push(cols)
        }
        chapterSummary.content.push('')
        chapterSummary.content.push('</table>\n')
      }

      chapterSummary.content.push('---\n')

      const testFailures = new TestFailures()
      const annotations: Annotation[] = []
      for (const [, results] of Object.entries(chapter.sections)) {
        const testResultSummaryName = results.summary.name

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

        for (const [, details] of Object.entries(detailGroup)) {
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
            for (const [, detail] of details.entries()) {
              const testResult = detail as ActionTestMetadata

              if (testResult.summaryRef) {
                const summary: ActionTestSummary = await this.parser.parse(
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

                    const workspace = path.dirname(
                      `${testReport.creatingWorkspaceFilePath}`
                    )
                    let filepath = ''
                    if (failureSummary.filePath) {
                      filepath = failureSummary.filePath.replace(
                        `${workspace}/`,
                        ''
                      )
                    }
                    if (
                      filepath &&
                      failureSummary.lineNumber &&
                      failureSummary.message
                    ) {
                      const annotation = new Annotation(
                        filepath,
                        failureSummary.lineNumber,
                        failureSummary.lineNumber,
                        'failure',
                        failureSummary.message,
                        failureSummary.issueType
                      )
                      annotations.push(annotation)
                    }
                  }
                }
              }
            }
          }
        }
      }
      for (const annotation of annotations) {
        testReport.annotations.push(annotation)
      }

      chapterSummary.content.push(`### ${failedIcon} Failures`)
      const summaryFailures: string[] = []

      for (const failureGroup of testFailures.failureGroups) {
        if (failureGroup.failures.length) {
          const testIdentifier = `${failureGroup.summaryIdentifier}_${failureGroup.identifier}`
          const anchorName = anchorIdentifier(testIdentifier)
          const anchorTag = anchorNameTag(`${testIdentifier}_failure-summary`)
          const testMethodLink = `${anchorTag}<a href="${anchorName}">${failureGroup.summaryIdentifier}/${failureGroup.identifier}</a>`
          summaryFailures.push(`<h4>${testMethodLink}</h4>`)
          for (const failure of failureGroup.failures) {
            for (const line of failure.lines) {
              summaryFailures.push(line)
            }
          }
        }
      }
      if (summaryFailures.length) {
        chapterSummary.content.push(summaryFailures.join('\n'))
        chapterSummary.content.push('')
      } else {
        chapterSummary.content.push('All tests passed :tada:\n')
      }

      if (testReport.codeCoverage && options.showCodeCoverage) {
        const workspace = path.dirname(
          `${testReport.creatingWorkspaceFilePath}`
        )
        chapterSummary.content.push('---\n')

        const re = new RegExp(`${workspace}/`, 'g')
        let root = ''
        if (process.env.GITHUB_REPOSITORY) {
          const pr = github.context.payload.pull_request
          const sha = (pr && pr.head.sha) || github.context.sha
          root = `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/blob/${sha}/`
        }
        chapterSummary.content.push(
          testReport.codeCoverage.lines.join('\n').replace(re, root)
        )
      }

      const testDetails = new TestDetails()
      for (const [, results] of Object.entries(chapter.sections)) {
        const testDetail = new TestDetail()
        testDetails.details.push(testDetail)

        const testResultSummaryName = results.summary.name
        const anchorTag = anchorNameTag(`${testResultSummaryName}`)
        const anchorName = anchorIdentifier(`${testResultSummaryName}_summary`)
        testDetail.lines.push(
          `#### ${anchorTag}${testResultSummaryName}[${backIcon}](${anchorName})`
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
                return [
                  passed,
                  failed,
                  skipped,
                  expectedFailure,
                  total,
                  duration
                ]
              },
              [0, 0, 0, 0, 0, 0]
            )

          const testName = `${groupIdentifier}`
          const passedRate = ((passed / total) * 100).toFixed(0)
          const failedRate = ((failed / total) * 100).toFixed(0)
          const skippedRate = ((skipped / total) * 100).toFixed(0)
          const expectedFailureRate = ((expectedFailure / total) * 100).toFixed(
            0
          )
          const testDuration = duration.toFixed(2)

          const anchorTag = anchorNameTag(
            `${testResultSummaryName}_${groupIdentifier}`
          )
          const anchorName = anchorIdentifier(
            `${testResultSummaryName}_${groupIdentifier}_summary`
          )
          const anchorBack = `[${backIcon}](${anchorName})`
          testDetail.lines.push(
            `${anchorTag}<h5>${testName}&nbsp;${anchorBack}</h5>`
          )

          const testsStatsLines: string[] = []

          testsStatsLines.push('<table>')
          testsStatsLines.push('<tr>')
          const header = [
            `<th>${passedIcon}`,
            `<th>${failedIcon}`,
            `<th>${skippedIcon}`,
            `<th>${expectedFailureIcon}`,
            `<th>:stopwatch:`
          ].join('')
          testsStatsLines.push(header)

          testsStatsLines.push('<tr>')
          let failedCount: string
          if (failed > 0) {
            failedCount = `<b>${failed} (${failedRate}%)</b>`
          } else {
            failedCount = `${failed} (${failedRate}%)`
          }
          const cols = [
            `<td align="right" width="154px">${passed} (${passedRate}%)`,
            `<td align="right" width="154px">${failedCount}`,
            `<td align="right" width="154px">${skipped} (${skippedRate}%)`,
            `<td align="right" width="154px">${expectedFailure} (${expectedFailureRate}%)`,
            `<td align="right" width="154px">${testDuration}s`
          ].join('')
          testsStatsLines.push(cols)
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
              } else if (
                statuses.every(status => status === 'Expected Failure')
              ) {
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

            let skippedPassedTests = 0
            for (const [index, detail] of details.entries()) {
              const testResult = detail as ActionTestMetadata
              if (!testResult.testStatus) {
                continue
              }

              const isFailure = testResult.testStatus === 'Failure'

              const rowSpan = `rowspan="${details.length}"`
              const valign = `valign="top"`
              const colWidth = 'width="52px"'
              const detailWidth = 'width="716px"'

              const status = Image.testStatus(testResult.testStatus)
              const resultLines: string[] = []

              if (testResult.summaryRef) {
                const summary: ActionTestSummary = await this.parser.parse(
                  testResult.summaryRef.id
                )

                if (summary.configuration) {
                  if (testResult.name) {
                    const anchorTag = anchorNameTag(
                      `${testResultSummaryName}_${testResult.identifier}`
                    )
                    const testMethodAnchor = isFailure ? anchorTag : ''
                    const backAnchorName = anchorIdentifier(
                      `${testResultSummaryName}_${testResult.identifier}_failure-summary`
                    )
                    const backAnchorLink = isFailure
                      ? `<a href="${backAnchorName}">${backIcon}</a>`
                      : ''
                    const testMethod = `${testMethodAnchor}${testMethodIcon}&nbsp;<code>${testResult.name}</code>${backAnchorLink}`
                    resultLines.push(`${status} ${testMethod}`)
                  }
                  if (!options.showPassedTests && !isFailure) {
                    skippedPassedTests++
                    continue
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
                  if (!options.showPassedTests && !isFailure) {
                    continue
                  }
                  if (testResult.name) {
                    const anchorTag = anchorNameTag(
                      `${testResultSummaryName}_${testResult.identifier}`
                    )
                    const testMethodAnchor = isFailure ? anchorTag : ''
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
                  await this.collectActivities(
                    summary.activitySummaries,
                    activities
                  )
                }
                if (activities.length) {
                  if (
                    !options.showPassedTests &&
                    summary.testStatus !== 'Failure'
                  ) {
                    continue
                  }

                  const testActivities = activities
                    .map(activity => {
                      const attachments = activity.attachments
                        .filter(attachment => {
                          return attachment.dimensions
                        })
                        .map(attachment => {
                          let width = '100%'
                          const dimensions = attachment.dimensions
                          if (dimensions.width && dimensions.height) {
                            const orientation = dimensions.orientation
                            if (orientation && orientation >= 5) {
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
                                    const value = dimensions.height / scale
                                    width = `${value.toFixed(0)}px`
                                  } else {
                                    const value = dimensions.width / scale
                                    width = `${value.toFixed(0)}px`
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
                        const open = testStatus.includes('Failure')
                          ? 'open'
                          : ''
                        const title = escapeHashSign(activity.title)
                        const message = `${indentation(
                          activity.indent
                        )}- ${title}`
                        const attachmentIndent = indentation(
                          activity.indent + 1
                        )
                        const attachmentContent = attachments.join('')
                        return `${message}\n${attachmentIndent}<details ${open}><summary>${attachmentIcon}</summary>${attachmentContent}</details>\n`
                      } else {
                        const indent = indentation(activity.indent)
                        return `${indent}- ${escapeHashSign(activity.title)}`
                      }
                    })
                    .join('\n')

                  resultLines.push(
                    `<br><b>Activities:</b>\n\n${testActivities}`
                  )
                }
              } else {
                if (!options.showPassedTests && !isFailure) {
                  continue
                }
                if (testResult.name) {
                  const anchorTag = anchorNameTag(
                    `${testResultSummaryName}_${testResult.identifier}`
                  )
                  const testMethodAnchor = isFailure ? anchorTag : ''
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
                if (index - skippedPassedTests === 0) {
                  testResultRow = `<tr><td align="center" ${rowSpan} ${valign} ${colWidth}>${groupStatusImage}<td ${valign} ${detailWidth}>${testResultContent}`
                } else {
                  testResultRow = `<tr><td ${valign} ${detailWidth}>${testResultContent}`
                }
              } else {
                testResultRow = `<tr><td align="center" ${valign} ${colWidth}>${status}<td ${valign} ${detailWidth}>${testResultContent}`
              }
              testDetailTable.push(testResultRow)
            }
          }

          testDetailTable.push(`</table>`)
          testDetailTable.push('')

          if (testDetailTable.join('').trim() === '<table></table>') {
            testDetail.lines.push('All tests passed :tada:\n')
          } else {
            testDetail.lines.push(testDetailTable.join('\n'))
          }
        }
      }

      const chapterDetail = new TestReportChapterDetail()
      chapter.details.push(chapterDetail)

      chapterDetail.content.push(testDetails.header)
      for (const testDetail of testDetails.details) {
        for (const detail of testDetail.lines) {
          chapterDetail.content.push(detail)
        }
      }
    }

    return testReport
  }

  async collectTestSummaries(
    group: ActionTestableSummary | ActionTestSummaryGroup,
    tests: actionTestSummaries,
    testSummaries: actionTestSummaries
  ): Promise<void> {
    for (const test of tests) {
      if (test.hasOwnProperty('subtests')) {
        const group = test as ActionTestSummaryGroup
        await this.collectTestSummaries(group, group.subtests, testSummaries)
      } else {
        const t = test as actionTestSummary & {group?: string}
        t.group = group.name
        testSummaries.push(test)
      }
    }
  }

  async collectActivities(
    activitySummaries: ActionTestActivitySummary[],
    activities: Activity[],
    indent = 0
  ): Promise<void> {
    for (const activitySummary of activitySummaries) {
      const activity = activitySummary as Activity
      activity.indent = indent
      await exportAttachments(this.parser, activity)
      activities.push(activity)

      if (activitySummary.subactivities) {
        await this.collectActivities(
          activitySummary.subactivities,
          activities,
          indent + 1
        )
      }
    }
  }
}

function collectFailureSummaries(
  failureSummaries: ActionTestFailureSummary[]
): FailureSummary[] {
  return failureSummaries.map(failureSummary => {
    const fileName = failureSummary.fileName
    const sourceCodeContext = failureSummary.sourceCodeContext
    const callStack = sourceCodeContext?.callStack
    const location = sourceCodeContext?.location
    const filePath = location?.filePath || fileName
    const lineNumber = location?.lineNumber

    let fileLocation = ''
    if (fileName && lineNumber) {
      fileLocation = `${fileName}:${lineNumber}`
    } else if (fileName) {
      fileLocation = fileName
    }

    const titleAlign = 'align="right"'
    const titleWidth = 'width="100px"'
    const titleAttr = `${titleAlign} ${titleWidth}`
    const detailWidth = 'width="668px"'
    const contents =
      '<table>' +
      `<tr><td ${titleAttr}><b>File</b><td ${detailWidth}>${fileLocation}` +
      `<tr><td ${titleAttr}><b>Issue Type</b><td ${detailWidth}>${failureSummary.issueType}` +
      `<tr><td ${titleAttr}><b>Message</b><td ${detailWidth}>${failureSummary.message}` +
      `</table>\n`

    const stackTrace = callStack
      ?.map((callStack, index) => {
        const addressString = callStack.addressString
        const symbolInfo = callStack.symbolInfo
        const imageName = symbolInfo?.imageName || ''
        const symbolName = symbolInfo?.symbolName || ''
        const location = symbolInfo?.location
        const filePath = location?.filePath || fileName
        const lineNumber = location?.lineNumber
        const seq = `${index}`.padEnd(2, ' ')
        return `${seq} ${imageName} ${addressString} ${symbolName} ${filePath}: ${lineNumber}`
      })
      .join('\n')
    return {
      filePath,
      lineNumber,
      issueType: failureSummary.issueType,
      message: failureSummary.message,
      contents,
      stackTrace: stackTrace || []
    } as FailureSummary
  })
}

interface FailureSummary {
  filePath: string
  lineNumber: number
  issueType: string
  message: string
  contents: string
  stackTrace: string
}

export class FormatterOptions {
  showPassedTests: boolean
  showCodeCoverage: boolean

  constructor(showPassedTests = true, showCodeCoverage = true) {
    this.showPassedTests = showPassedTests
    this.showCodeCoverage = showCodeCoverage
  }
}
