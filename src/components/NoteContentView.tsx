import { useMemo } from 'react'
import { parseNoteContent } from '../utils/noteContent'

interface ContentMedia {
  id: string
  media_type: 'image' | 'video'
  public_url: string
}

interface NoteContentViewProps {
  content: string
  media?: ContentMedia[]
  className?: string
}

export function NoteContentView({ content, media = [], className }: NoteContentViewProps) {
  const segments = useMemo(() => parseNoteContent(content), [content])
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media])

  const hasInlineImages = segments.some((segment) => segment.type === 'image')

  return (
    <div className={className ? `note-content-view ${className}` : 'note-content-view'}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          if (!segment.value) return null
          return (
            <div key={`text-${index}`} className="note-body-text note-content-view__text">
              {segment.value}
            </div>
          )
        }

        const item = mediaById.get(segment.id)
        if (!item || item.media_type !== 'image') return null
        return (
          <div key={`image-${segment.id}-${index}`} className="note-inline-image note-inline-image--readonly">
            <img src={item.public_url} alt="" loading="lazy" />
          </div>
        )
      })}

      {!hasInlineImages && media.length > 0 && (
        <div className="media-grid">
          {media.map((item) => (
            <div key={item.id} className="media-item">
              {item.media_type === 'image' ? (
                <img src={item.public_url} alt="" loading="lazy" />
              ) : (
                <video src={item.public_url} controls preload="metadata" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
