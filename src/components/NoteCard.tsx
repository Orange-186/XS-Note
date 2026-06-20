import { Link } from 'react-router-dom'
import type { Note } from '../types/note'
import { formatRelativeTime, getContentSummary } from '../utils/formatDate'
import { Swipeable } from './Swipeable'

interface NoteCardProps {
  note: Note
  onDelete: (id: string) => void
}

export function NoteCard({ note, onDelete }: NoteCardProps) {
  const cover =
    note.cover_url ||
    note.note_media?.find((m) => m.media_type === 'image')?.public_url

  return (
    <Swipeable onDelete={() => onDelete(note.id)}>
      <article className="note-card">
        <Link to={`/note/${note.id}`} className="note-card__link">
          {cover && (
            <div className="note-card__cover">
              <img src={cover} alt="" loading="lazy" />
            </div>
          )}
          <div className="note-card__body">
            <div className="note-card__meta">
              <time className="note-card__time">{formatRelativeTime(note.updated_at)}</time>
            </div>
            <h2 className="note-card__title">{note.title.trim() || '无标题'}</h2>
            <p className="note-card__summary">{getContentSummary(note.content)}</p>
          </div>
        </Link>
      </article>
    </Swipeable>
  )
}
