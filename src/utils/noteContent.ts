export const IMAGE_MARKER_RE = /!\[\[media:([0-9a-f-]{36})\]\]/gi

export type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'image'; id: string }

export function parseNoteContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  const re = new RegExp(IMAGE_MARKER_RE.source, 'gi')
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'image', id: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', value: '' })
  }

  return segments
}

export function serializeNoteContent(segments: ContentSegment[]): string {
  return segments
    .map((segment) => (segment.type === 'text' ? segment.value : `![[media:${segment.id}]]`))
    .join('')
}

export function stripImageMarkers(content: string): string {
  return content
    .replace(new RegExp(IMAGE_MARKER_RE.source, 'gi'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function contentHasImageMarkers(content: string): boolean {
  return new RegExp(IMAGE_MARKER_RE.source, 'i').test(content)
}

export function mediaIdsInContentOrder(content: string): string[] {
  const ids: string[] = []
  const re = new RegExp(IMAGE_MARKER_RE.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    ids.push(match[1])
  }
  return ids
}

export function insertImageMarker(content: string, offset: number, mediaId: string): string {
  const marker = `\n![[media:${mediaId}]]\n`
  const safeOffset = Math.max(0, Math.min(offset, content.length))
  return content.slice(0, safeOffset) + marker + content.slice(safeOffset)
}

export function removeImageMarker(content: string, mediaId: string): string {
  const marker = `![[media:${mediaId}]]`
  return content
    .split(marker)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
}

export function globalOffset(
  segments: ContentSegment[],
  segmentIndex: number,
  localOffset: number,
): number {
  let offset = 0
  for (let i = 0; i < segmentIndex; i++) {
    const segment = segments[i]
    if (segment.type === 'text') offset += segment.value.length
    else offset += `![[media:${segment.id}]]`.length
  }
  return offset + localOffset
}

export function getTextareaCaretRect(textarea: HTMLTextAreaElement, position: number): DOMRect {
  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const properties = [
    'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'textTransform',
    'wordSpacing', 'textIndent', 'lineHeight', 'whiteSpace', 'wordBreak', 'overflowWrap',
  ] as const

  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordBreak = 'break-word'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'

  for (const prop of properties) {
    mirror.style[prop] = style[prop]
  }

  const value = textarea.value.substring(0, position)
  mirror.textContent = value
  const marker = document.createElement('span')
  marker.textContent = value.length < textarea.value.length ? textarea.value.charAt(position) || '.' : '.'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)

  const rect = marker.getBoundingClientRect()
  document.body.removeChild(mirror)
  return rect
}
