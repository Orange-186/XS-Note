import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NoteContentView } from '../components/NoteContentView'
import { getContentSummary } from '../utils/formatDate'
import { fetchPublishedShare, parseShareToken, type SharedNoteView } from '../utils/publishSharePage'

function setMetaTag(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`
  let tag = document.querySelector(selector)
  if (!tag) {
    tag = document.createElement('meta')
    if (property) tag.setAttribute('property', name)
    else tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function SharePageShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <main className="app-main">
        <div className="share-page">{children}</div>
      </main>
    </div>
  )
}

export function SharePage() {
  const { token } = useParams<{ token: string }>()
  const [note, setNote] = useState<SharedNoteView | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!token) {
      setMissing(true)
      setLoading(false)
      return
    }

    const parsed = parseShareToken(token)
    if (!parsed) {
      setMissing(true)
      setLoading(false)
      return
    }

    fetchPublishedShare(parsed.userId, parsed.noteId).then((data) => {
      if (!data) {
        setMissing(true)
      } else {
        setNote(data)
      }
      setLoading(false)
    })
  }, [token])

  useEffect(() => {
    if (!note) return

    const title = note.title.trim() || '无标题'
    const description = getContentSummary(note.content, 120)
    const image =
      note.cover_url ||
      note.note_media.find((item) => item.media_type === 'image')?.public_url ||
      `${window.location.origin}${import.meta.env.BASE_URL}og-default.png`

    document.title = `${title} · XS Note`
    setMetaTag('description', description)
    setMetaTag('og:title', title, true)
    setMetaTag('og:description', description, true)
    setMetaTag('og:image', image, true)
    setMetaTag('og:type', 'article', true)
  }, [note])

  if (loading) {
    return (
      <SharePageShell>
        <div className="page-loading page-loading--inline">
          <div className="spinner" aria-label="加载中" />
        </div>
      </SharePageShell>
    )
  }

  if (missing || !note) {
    return (
      <SharePageShell>
        <div className="share-page__card share-page__card--empty">
          <h1>分享不存在</h1>
          <p>该笔记可能尚未发布分享，或链接已失效。</p>
          <Link to="/" className="btn btn--primary">返回 XS Note</Link>
        </div>
      </SharePageShell>
    )
  }

  const title = note.title.trim() || '无标题'
  const media = [...note.note_media].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <SharePageShell>
      <div className="share-page__card">
        <div className="share-page__body editor-body">
          <p className="share-page__brand">XS NOTE · 公开分享</p>
          <h1 className="share-page__title editor-title">{title}</h1>
          {(note.content.trim() || media.length > 0) && (
            <NoteContentView content={note.content} media={media} />
          )}

          <div className="share-page__actions">
            <Link to="/" className="btn btn--primary">打开 XS Note</Link>
          </div>
        </div>
      </div>
    </SharePageShell>
  )
}
