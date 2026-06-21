import { useCallback, useEffect, useRef, useState } from 'react'
import type { LocalMedia } from '../types/note'
import {
  blocksToContent,
  contentToBlocks,
  insertImageBlock,
  removeImageBlock,
  resolveMediaUrl,
  type ContentBlock,
} from '../utils/noteContent'

interface NoteContentEditorProps {
  content: string
  media: LocalMedia[]
  onChange: (content: string) => void
  insertImageRef?: React.MutableRefObject<(mediaId: string) => void>
  onRemoveMedia?: (mediaId: string) => void
}

export function NoteContentEditor({ content, media, onChange, insertImageRef, onRemoveMedia }: NoteContentEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => contentToBlocks(content))
  const activeTextRef = useRef<{ index: number; cursor: number }>({ index: 0, cursor: 0 })
  const syncingRef = useRef(false)

  useEffect(() => {
    if (syncingRef.current) return
    setBlocks(contentToBlocks(content))
  }, [content])

  const emitChange = useCallback(
    (nextBlocks: ContentBlock[]) => {
      syncingRef.current = true
      setBlocks(nextBlocks)
      onChange(blocksToContent(nextBlocks))
      window.requestAnimationFrame(() => {
        syncingRef.current = false
      })
    },
    [onChange],
  )

  const handleInsertImage = useCallback(
    (mediaId: string) => {
      const { index, cursor } = activeTextRef.current
      const textIndex = blocks[index]?.type === 'text' ? index : blocks.findIndex((b) => b.type === 'text')
      const targetIndex = textIndex >= 0 ? textIndex : 0
      const cursorPos =
        blocks[targetIndex]?.type === 'text' && targetIndex === index
          ? cursor
          : blocks[targetIndex]?.type === 'text'
            ? blocks[targetIndex].text.length
            : 0

      emitChange(insertImageBlock(blocks, targetIndex, cursorPos, mediaId))
    },
    [blocks, emitChange],
  )

  useEffect(() => {
    if (insertImageRef) {
      insertImageRef.current = handleInsertImage
    }
  }, [handleInsertImage, insertImageRef])

  const updateTextBlock = (index: number, text: string) => {
    const next = blocks.map((block, i) => (i === index && block.type === 'text' ? { ...block, text } : block))
    emitChange(next)
  }

  const trackCursor = (index: number, target: HTMLTextAreaElement) => {
    activeTextRef.current = { index, cursor: target.selectionStart ?? target.value.length }
  }

  const handleRemoveImage = (index: number) => {
    const block = blocks[index]
    if (block?.type === 'image') {
      onRemoveMedia?.(block.mediaId)
    }
    emitChange(removeImageBlock(blocks, index))
  }

  return (
    <div className="note-content-editor">
      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <textarea
              key={block.id}
              className="editor-content note-body-text note-content-editor__text"
              placeholder={index === 0 ? '开始书写…' : ''}
              value={block.text}
              rows={Math.max(1, block.text.split('\n').length)}
              onChange={(e) => updateTextBlock(index, e.target.value)}
              onSelect={(e) => trackCursor(index, e.currentTarget)}
              onFocus={(e) => trackCursor(index, e.currentTarget)}
              onClick={(e) => trackCursor(index, e.currentTarget)}
              onKeyUp={(e) => trackCursor(index, e.currentTarget)}
            />
          )
        }

        const url = resolveMediaUrl(block.mediaId, media)

        return (
          <figure key={block.id} className="inline-image">
            {url ? (
              <img src={url} alt="" />
            ) : (
              <div className="inline-image__placeholder" aria-hidden="true" />
            )}
            <button
              type="button"
              className="inline-image__remove"
              onClick={() => handleRemoveImage(index)}
              aria-label="移除图片"
            >
              ×
            </button>
          </figure>
        )
      })}
    </div>
  )
}
