/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface ActivityLogMajorSection {
  domainType: string
  title: string
  startTime?: string
  duration: number
  result?: string
  location?: DocumentLocation
  subsections: ActivityLogSection[]
  messages: ActivityLogMessage[]
  subtitle: string
}
export interface DocumentLocation {
  url: string
  concreteTypeName: string
}
export interface ActivityLogSection {
  domainType: string
  title: string
  startTime?: string
  duration: number
  result?: string
  location?: DocumentLocation
  subsections: ActivityLogSection[]
  messages: ActivityLogMessage[]
}
export interface ActivityLogMessage {
  type: string
  title: string
  shortTitle?: string
  category?: string
  location?: DocumentLocation
  annotations: ActivityLogMessageAnnotation[]
}
export interface ActivityLogMessageAnnotation {
  title: string
  location?: DocumentLocation
}
