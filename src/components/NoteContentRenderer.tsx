import type { ContentSegment } from '../utils/noteContent'

interface NoteContentRendererProps {
  segments: ContentSegment[]
  className?: string
}

export function NoteContentRenderer({ segments, className }: NoteContentRendererProps) {
  if (segments.length === 0) return null

  return (
    <div className={className ?? 'note-content-renderer note-body-text'}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={`text-${index}`} className="note-content-renderer__text">{segment.text}</span>
        }

        return (
          <figure key={`img-${segment.mediaId}-${index}`} className="inline-image inline-image--readonly">
            <img src={segment.url} alt={segment.alt} loading="lazy" />
          </figure>
        )
      })}
    </div>
  )
}
