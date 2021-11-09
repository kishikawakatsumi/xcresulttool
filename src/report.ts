import {ActionRunDestinationRecord} from '../dev/@types/ActionRunDestinationRecord.d'
import {ActionTestMetadata} from '../dev/@types/ActionTestMetadata.d'
import {ActionTestSummary} from '../dev/@types/ActionTestSummary.d'
import {ActionTestSummaryGroup} from '../dev/@types/ActionTestSummaryGroup.d'
import {ActionTestSummaryIdentifiableObject} from '../dev/@types/ActionTestSummaryIdentifiableObject.d'
import {ActionTestableSummary} from '../dev/@types/ActionTestableSummary.d'
import {CodeCoverage} from './coverage'

export class TestReport {
  entityName?: string
  creatingWorkspaceFilePath?: string
  testStatus = 'neutral'

  readonly chapters: TestReportChapter[] = []
  codeCoverage?: TestCodeCoverage
  readonly annotations: Annotation[] = []

  get reportSummary(): string {
    const lines: string[] = []

    for (const chapter of this.chapters) {
      for (const chapterSummary of chapter.summaries) {
        let summaryTitle = ''
        if (chapter.title) {
          summaryTitle = `## ${chapter.title}`
        } else if (this.entityName) {
          summaryTitle = `## ${chapter.schemeCommandName} ${this.entityName}`
        } else {
          summaryTitle = `## ${chapter.schemeCommandName}`
        }
        const summaryContent = chapterSummary.content.join('\n')
        lines.push(`${summaryTitle}\n\n${summaryContent}`)
      }
    }

    return lines.join('\n')
  }

  get reportDetail(): string {
    const lines: string[] = []

    for (const chapter of this.chapters) {
      for (const chapterDetail of chapter.details) {
        lines.push(chapterDetail.content.join('\n'))
      }
    }

    return lines.join('\n')
  }
}

export class TestReportChapter {
  readonly title?: string
  readonly schemeCommandName: string
  readonly runDestination: ActionRunDestinationRecord
  readonly sections: {[key: string]: TestReportSection} = {}

  readonly summaries: TestReportChapterSummary[] = []
  readonly details: TestReportChapterDetail[] = []

  constructor(
    schemeCommandName: string,
    runDestination: ActionRunDestinationRecord,
    title?: string
  ) {
    this.schemeCommandName = schemeCommandName
    this.runDestination = runDestination
    this.title = title
  }
}

export class TestReportChapterSummary {
  readonly content: string[] = []
}

export class TestReportChapterDetail {
  readonly content: string[] = []
}

export class TestReportSection {
  readonly summary: ActionTestableSummary
  readonly details: actionTestSummaries

  readonly sectionSummary: string[] = []

  constructor(summary: ActionTestableSummary, details: actionTestSummaries) {
    this.summary = summary
    this.details = details
  }
}

export class TestDetails {
  readonly header = '### Test Details\n'
  readonly details: TestDetail[] = []
}

export class TestDetail {
  readonly lines: string[] = []
}

export class TestFailures {
  readonly failureGroups: TestFailureGroup[] = []
}

export class TestFailureGroup {
  readonly summaryIdentifier: string
  readonly identifier: string
  readonly name: string

  readonly failures: TestFailure[] = []

  constructor(summaryIdentifier: string, identifier: string, name: string) {
    this.summaryIdentifier = summaryIdentifier
    this.identifier = identifier
    this.name = name
  }
}

export class TestFailure {
  readonly lines: string[] = []
}

export class TestCodeCoverage {
  readonly lines: string[] = []

  constructor(codeCoverage: CodeCoverage) {
    const baseUrl = 'https://xcresulttool-static.netlify.app/i/'

    this.lines.push('### Code Coverage')
    this.lines.push('<table>')
    this.lines.push('<tr>')
    this.lines.push('<th width="324px">')
    this.lines.push('<th width="244px" colspan="2">Coverage')
    this.lines.push('<th width="100px">Covered')
    this.lines.push('<th width="100px">Executable')

    const total = {
      name: 'Total',
      lineCoverage: 0,
      coveredLines: 0,
      executableLines: 0,
      hasCodeCoverage: false
    }

    for (const target of codeCoverage.targets) {
      if (target.name.endsWith('.xctest')) {
        continue
      }
      total.hasCodeCoverage = true

      {
        const lineCoverage = target.lineCoverage * 100

        this.lines.push('<tr>')
        this.lines.push(`<td>${target.name}`)
        const image = `${lineCoverage.toFixed(0)}.svg`
        this.lines.push(`<td><img src="${baseUrl}${image}"/>`)
        this.lines.push(`<td align="right">${lineCoverage.toFixed(2)} %`)
        this.lines.push(`<td align="right">${target.coveredLines}`)
        this.lines.push(`<td align="right">${target.executableLines}`)
      }

      total.coveredLines += target.coveredLines
      total.executableLines += target.executableLines

      for (const file of target.files) {
        const lineCoverage = file.lineCoverage * 100

        this.lines.push('<tr>')
        this.lines.push(`<td>&nbsp;&nbsp;${file.name}`)
        const image = `${lineCoverage.toFixed(0)}.svg`
        this.lines.push(`<td><img src="${baseUrl}${image}"/>`)
        this.lines.push(`<td align="right">${lineCoverage.toFixed(2)} %`)
        this.lines.push(`<td align="right">${file.coveredLines}`)
        this.lines.push(`<td align="right">${file.executableLines}`)
      }
    }

    if (total.hasCodeCoverage) {
      const lineCoverage = (total.coveredLines / total.executableLines) * 100

      this.lines.push('<tr>')
      this.lines.push(`<td><b>${total.name}`)
      const image = `${lineCoverage.toFixed(0)}.svg`
      this.lines.push(`<td><img src="${baseUrl}${image}"/>`)
      this.lines.push(`<td align="right"><b>${lineCoverage.toFixed(2)} %`)
      this.lines.push(`<td align="right"><b>${total.coveredLines}`)
      this.lines.push(`<td align="right"><b>${total.executableLines}`)

      this.lines.push('</table>\n')
    }
  }
}

export class Annotation {
  path: string
  start_line: number
  end_line: number
  start_column?: number
  end_column?: number
  annotation_level: string
  message: string
  title?: string
  raw_details?: string

  constructor(
    path: string,
    start_line: number,
    end_line: number,
    annotation_level: string,
    message: string,
    title?: string,
    raw_details?: string
  ) {
    this.path = path
    this.start_line = start_line
    this.end_line = end_line
    this.annotation_level = annotation_level
    this.message = message
    this.title = title
    this.raw_details = raw_details
  }
}

export type actionTestSummary =
  | ActionTestSummaryIdentifiableObject
  | ActionTestSummaryGroup
  | ActionTestSummary
  | ActionTestMetadata

export type actionTestSummaries = actionTestSummary[]
