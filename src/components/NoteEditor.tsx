import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LocalMedia } from '../types/note'
import { MAX_IMAGES } from '../types/note'
import {
  getTextareaCaretRect,
  globalOffset,
  insertImageMarker,
  parseNoteContent,
  serializeNoteContent,
  type ContentSegment,
} from '../utils/noteContent'

interface InsertHint {
  top: number
  left: number
  offset: number
}

interface NoteEditorProps {
  content: string
  media: LocalMedia[]
  imageCount: number
  onContentChange: (content: string) => void
  onMediaAdd: (items: LocalMedia[]) => void
  onMediaRemove: (mediaId: string) => void
  onError: (message: string) => void
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = '0px'
  textarea.style.height = `${textarea.scrollHeight}px`
}

export function NoteEditor({
  content,
  media,
  imageCount,
  onContentChange,
  onMediaAdd,
  onMediaRemove,
  onError,
}: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingOffsetRef = useRef(0)
  const textareaRefs = useRef<Array<HTMLTextAreaElement | null>>([])

  const [insertHint, setInsertHint] = useState<InsertHint | null>(null)

  const segments = useMemo(() => parseNoteContent(content), [content])
  const mediaById = useMemo(
    () => new Map(media.filter((item) => !item.markedForDelete).map((item) => [item.id, item])),
    [media],
  )

  const hideInsertHint = useCallback(() => setInsertHint(null), [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (editorRef.current?.contains(target)) return
      hideInsertHint()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [hideInsertHint])

  useEffect(() => {
    textareaRefs.current.forEach((textarea) => {
      if (textarea) resizeTextarea(textarea)
    })
  }, [segments])

  const showHintAtCaret = useCallback(
    (textarea: HTMLTextAreaElement, segmentIndex: number) => {
      const editor = editorRef.current
      if (!editor) return

      const caret = textarea.selectionStart ?? textarea.value.length
      const caretRect = getTextareaCaretRect(textarea, caret)
      const editorRect = editor.getBoundingClientRect()

      setInsertHint({
        top: caretRect.bottom - editorRect.top + editor.scrollTop + 6,
        left: Math.max(0, caretRect.left - editorRect.left),
        offset: globalOffset(segments, segmentIndex, caret),
      })
    },
    [segments],
  )

  const showHintAtPoint = useCallback(
    (clientX: number, clientY: number, offset: number) => {
      const editor = editorRef.current
      if (!editor) return

      const editorRect = editor.getBoundingClientRect()
      setInsertHint({
        top: clientY - editorRect.top + editor.scrollTop,
        left: Math.max(0, clientX - editorRect.left),
        offset,
      })
    },
    [],
  )

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    showHintAtPoint(event.clientX, event.clientY, content.length)
  }

  const updateTextSegment = (segmentIndex: number, value: string) => {
    const nextSegments: ContentSegment[] = segments.map((segment, index) =>
      index === segmentIndex && segment.type === 'text' ? { type: 'text', value } : segment,
    )
    onContentChange(serializeNoteContent(nextSegments))
  }

  const handleInsertImageClick = () => {
    if (imageCount >= MAX_IMAGES) {
      onError(`图片最多 ${MAX_IMAGES} 张`)
      return
    }
    pendingOffsetRef.current = insertHint?.offset ?? content.length
    fileInputRef.current?.click()
  }

  const handleImageSelected = (files: FileList | null) => {
    if (!files?.length) return
    if (imageCount >= MAX_IMAGES) {
      onError(`图片最多 ${MAX_IMAGES} 张`)
      return
    }

    const file = files[0]
    const mediaId = crypto.randomUUID()
    const item: LocalMedia = {
      id: mediaId,
      file,
      media_type: 'image',
      public_url: URL.createObjectURL(file),
      sort_order: media.length,
      isNew: true,
    }

    onMediaAdd([item])
    onContentChange(insertImageMarker(content, pendingOffsetRef.current, mediaId))
    hideInsertHint()
  }

  return (
    <div ref={editorRef} className="note-editor" onClick={handleEditorClick}>
      <div className="note-editor__segments" onClick={(event) => {
        if (event.target === event.currentTarget) {
          showHintAtPoint(event.clientX, event.clientY, content.length)
        }
      }}>
        {segments.map((segment, index) => {
          if (segment.type === 'image') {
            const item = mediaById.get(segment.id)
            if (!item) return null
            return (
              <div key={`image-${segment.id}-${index}`} className="note-inline-image">
                <img src={item.public_url} alt="" />
                <button
                  type="button"
                  className="note-inline-image__remove"
                  onClick={() => onMediaRemove(segment.id)}
                  aria-label="移除图片"
                >
                  ×
                </button>
              </div>
            )
          }

          return (
            <textarea
              key={`text-${index}`}
              ref={(node) => {
                textareaRefs.current[index] = node
              }}
              className="note-editor__textarea note-body-text"
              value={segment.value}
              placeholder={index === 0 ? '开始书写…' : ''}
              rows={1}
              onChange={(event) => {
                updateTextSegment(index, event.target.value)
                resizeTextarea(event.target)
              }}
              onClick={(event) => {
                event.stopPropagation()
                showHintAtCaret(event.currentTarget, index)
              }}
              onKeyUp={(event) => showHintAtCaret(event.currentTarget, index)}
              onSelect={(event) => showHintAtCaret(event.currentTarget, index)}
              onFocus={(event) => showHintAtCaret(event.currentTarget, index)}
            />
          )
        })}
      </div>

      {insertHint && (
        <button
          type="button"
          className="note-editor__insert-btn"
          style={{ top: insertHint.top, left: insertHint.left }}
          onClick={(event) => {
            event.stopPropagation()
            handleInsertImageClick()
          }}
        >
          插入图片
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          handleImageSelected(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
