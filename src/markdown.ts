export function anchorIdentifier(text: string): string {
  return `#user-content-${text.toLowerCase()}`.replace(/ /g, '-')
}

export function anchorNameTag(text: string): string {
  const name = text.toLowerCase().replace(/ /g, '-')
  return `<a name="${name}"/>`
}

export function escapeHashSign(text: string): string {
  return text.replace(/#/g, '<span>#</span>')
}

export function indentation(level: number): string {
  return '  '.repeat(level)
}
