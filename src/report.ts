import {ActionTestMetadata} from '../dev/@types/ActionTestMetadata.d'
import {ActionTestSummary} from '../dev/@types/ActionTestSummary.d'
import {ActionTestSummaryGroup} from '../dev/@types/ActionTestSummaryGroup.d'
import {ActionTestSummaryIdentifiableObject} from '../dev/@types/ActionTestSummaryIdentifiableObject.d'
import {ActionTestableSummary} from '../dev/@types/ActionTestableSummary.d'

export class TestReport {
  entityName?: string
  readonly chapters: TestReportChapter[] = []
  annotations: Annotation[] = []

  get reportSummary(): string {
    const lines: string[] = []

    for (const chapter of this.chapters) {
      for (const chapterSummary of chapter.summaries) {
        const summaryTitle = `### ${chapter.schemeCommandName} ${this.entityName}`
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
  readonly schemeCommandName: string
  readonly sections: {[key: string]: TestReportSection} = {}

  readonly summaries: TestReportChapterSummary[] = []
  readonly details: TestReportChapterDetail[] = []

  constructor(schemeCommandName: string) {
    this.schemeCommandName = schemeCommandName
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
