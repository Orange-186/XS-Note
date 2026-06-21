import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getContentSummary } from '../utils/formatDate'
import { markdownToHtml } from '../utils/shareContent'
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
      <div className="page-loading">
        <div className="spinner" aria-label="加载中" />
      </div>
    )
  }

  if (missing || !note) {
    return (
      <div className="share-page">
        <div className="share-page__card share-page__card--empty">
          <h1>分享不存在</h1>
          <p>该笔记可能尚未发布分享，或链接已失效。</p>
          <Link to="/" className="btn btn--primary">返回 XS Note</Link>
        </div>
      </div>
    )
  }

  const title = note.title.trim() || '无标题'
  const summary = getContentSummary(note.content, 160)
  const cover =
    note.cover_url ||
    note.note_media.find((item) => item.media_type === 'image')?.public_url
  const images = note.note_media.filter((item) => item.media_type === 'image')

  return (
    <div className="share-page">
      <div className="share-page__card">
        {cover && (
          <div className="share-page__cover">
            <img src={cover} alt={title} />
          </div>
        )}

        <div className="share-page__body">
          <p className="share-page__brand">XS NOTE · 公开分享</p>
          <h1 className="share-page__title">{title}</h1>
          <p className="share-page__summary">{summary}</p>
          {note.content.trim() && (
            <div
              className="share-page__content"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(note.content) }}
            />
          )}

          {images.length > 1 && (
            <div className="share-page__gallery">
              {images.slice(cover ? 1 : 0).map((item) => (
                <img key={item.public_url} src={item.public_url} alt="" loading="lazy" />
              ))}
            </div>
          )}

          <div className="share-page__actions">
            <Link to="/" className="btn btn--primary">打开 XS Note</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
