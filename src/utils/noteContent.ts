import type { LocalMedia } from '../types/note'

export const IMG_MARKER_RE = /\{\{img:([a-zA-Z0-9-]+)\}\}/g

export type ContentBlock =
  | { type: 'text'; id: string; text: string }
  | { type: 'image'; id: string; mediaId: string }

export type ContentSegment =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaId: string; url: string; alt: string }

export function contentToBlocks(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const parts = content.split(IMG_MARKER_RE)

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) {
        blocks.push({ type: 'text', id: crypto.randomUUID(), text: parts[i] })
      }
    } else {
      blocks.push({ type: 'image', id: crypto.randomUUID(), mediaId: parts[i] })
    }
  }

  if (blocks.length === 0) {
    blocks.push({ type: 'text', id: crypto.randomUUID(), text: '' })
  }

  return blocks
}

export function blocksToContent(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => (block.type === 'text' ? block.text : `{{img:${block.mediaId}}}`))
    .join('')
}

function mergeAdjacentTextBlocks(blocks: ContentBlock[]): ContentBlock[] {
  const merged: ContentBlock[] = []

  for (const block of blocks) {
    const prev = merged[merged.length - 1]
    if (block.type === 'text' && prev?.type === 'text') {
      prev.text += block.text
    } else if (block.type === 'text' && !block.text) {
      continue
    } else {
      merged.push(block.type === 'text' ? { ...block } : { ...block })
    }
  }

  if (merged.length === 0) {
    merged.push({ type: 'text', id: crypto.randomUUID(), text: '' })
  }

  return merged
}

export function insertImageBlock(
  blocks: ContentBlock[],
  textBlockIndex: number,
  cursorPos: number,
  mediaId: string,
): ContentBlock[] {
  const block = blocks[textBlockIndex]
  if (!block || block.type !== 'text') {
    return mergeAdjacentTextBlocks([
      ...blocks,
      { type: 'image', id: crypto.randomUUID(), mediaId },
      { type: 'text', id: crypto.randomUUID(), text: '' },
    ])
  }

  const before = block.text.slice(0, cursorPos)
  const after = block.text.slice(cursorPos)

  const next: ContentBlock[] = [
    ...blocks.slice(0, textBlockIndex),
    ...(before ? [{ type: 'text' as const, id: crypto.randomUUID(), text: before }] : []),
    { type: 'image', id: crypto.randomUUID(), mediaId },
    ...(after ? [{ type: 'text' as const, id: crypto.randomUUID(), text: after }] : []),
    ...blocks.slice(textBlockIndex + 1),
  ]

  return mergeAdjacentTextBlocks(next)
}

export function removeImageBlock(blocks: ContentBlock[], blockIndex: number): ContentBlock[] {
  return mergeAdjacentTextBlocks(blocks.filter((_, index) => index !== blockIndex))
}

export function stripImageMarkers(content: string): string {
  return content.replace(IMG_MARKER_RE, ' ').replace(/\s+/g, ' ').trim()
}

export function appendMissingImageMarkers(content: string, mediaIds: string[]): string {
  let result = content
  for (const mediaId of mediaIds) {
    const marker = `{{img:${mediaId}}}`
    if (!result.includes(marker)) {
      result += `${result.endsWith('\n') || !result ? '' : '\n'}${marker}\n`
    }
  }
  return result
}

export function collectReferencedMediaIds(content: string): Set<string> {
  const ids = new Set<string>()
  for (const match of content.matchAll(IMG_MARKER_RE)) {
    ids.add(match[1])
  }
  return ids
}

export function resolveMediaUrl(mediaId: string, media: LocalMedia[]): string | null {
  const item = media.find((m) => m.id === mediaId && !m.markedForDelete)
  return item?.public_url ?? null
}

export function parseContentSegments(
  content: string,
  media: Array<{ id: string; public_url: string; media_type: string; markedForDelete?: boolean }>,
): ContentSegment[] {
  const segments: ContentSegment[] = []
  const parts = content.split(IMG_MARKER_RE)

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) segments.push({ type: 'text', text: parts[i] })
    } else {
      const mediaId = parts[i]
      const item = media.find((m) => m.id === mediaId && !m.markedForDelete)
      if (item?.media_type === 'image') {
        segments.push({ type: 'image', mediaId, url: item.public_url, alt: '' })
      }
    }
  }

  return segments
}
