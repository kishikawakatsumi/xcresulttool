/* tslint:disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

export interface SourceCodeContext {
  location?: SourceCodeLocation
  callStack: SourceCodeFrame[]
}
export interface SourceCodeLocation {
  filePath?: string
  lineNumber?: number
}
export interface SourceCodeFrame {
  addressString?: string
  symbolInfo?: SourceCodeSymbolInfo
}
export interface SourceCodeSymbolInfo {
  imageName?: string
  symbolName?: string
  location?: SourceCodeLocation
}
