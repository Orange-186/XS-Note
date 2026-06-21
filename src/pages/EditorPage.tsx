import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { ShareSheet } from '../components/ShareSheet'
import { useAuth } from '../contexts/AuthContext'
import { fetchNoteById, saveNote } from '../hooks/useNotes'
import { useTheme } from '../hooks/useTheme'
import type { LocalMedia, NoteMedia } from '../types/note'
import { MAX_IMAGES, MAX_VIDEOS } from '../types/note'
import { exportNoteAsImage } from '../utils/exportNote'

function mapRemoteMedia(noteMedia?: NoteMedia[]): LocalMedia[] {
  return (noteMedia ?? []).map((m) => ({
    id: m.id,
    media_type: m.media_type,
    public_url: m.public_url,
    storage_path: m.storage_path,
    sort_order: m.sort_order,
  }))
}

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [media, setMedia] = useState<LocalMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const dirtyRef = useRef(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return

    fetchNoteById(id).then((note) => {
      if (!note) {
        setError('笔记不存在')
        setLoading(false)
        return
      }
      setTitle(note.title)
      setContent(note.content)
      setMedia(mapRemoteMedia(note.note_media))
      setLoading(false)
    })
  }, [id])

  const markDirty = () => {
    dirtyRef.current = true
  }

  const imageCount = media.filter((m) => m.media_type === 'image' && !m.markedForDelete).length
  const videoCount = media.filter((m) => m.media_type === 'video' && !m.markedForDelete).length

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!id || !user || saving) return false
    setSaving(true)
    setError(null)

    try {
      await saveNote(id, user.id, title, content, media)
      dirtyRef.current = false
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }, [id, user, saving, title, content, media])

  const handleBack = async () => {
    if (dirtyRef.current) {
      const ok = await handleSave()
      if (!ok) return
    }
    navigate('/')
  }

  const handleSaveAndStay = async () => {
    await handleSave()
  }

  const addFiles = (files: FileList | null, type: 'image' | 'video') => {
    if (!files?.length) return

    const currentCount = type === 'image' ? imageCount : videoCount
    const max = type === 'image' ? MAX_IMAGES : MAX_VIDEOS
    const remaining = max - currentCount

    if (remaining <= 0) {
      setError(type === 'image' ? `图片最多 ${MAX_IMAGES} 张` : `视频最多 ${MAX_VIDEOS} 个`)
      return
    }

    const selected = Array.from(files).slice(0, remaining)
    const next: LocalMedia[] = selected.map((file, index) => ({
      id: crypto.randomUUID(),
      file,
      media_type: type,
      public_url: URL.createObjectURL(file),
      sort_order: media.length + index,
      isNew: true,
    }))

    setMedia((prev) => [...prev, ...next])
    markDirty()
    setError(null)
  }

  const removeMedia = (mediaId: string) => {
    setMedia((prev) =>
      prev.map((m) => {
        if (m.id !== mediaId) return m
        if (m.isNew) return { ...m, markedForDelete: true }
        return { ...m, markedForDelete: true }
      }),
    )
    markDirty()
  }

  const visibleMedia = media.filter((m) => !m.markedForDelete)
  const coverUrl = visibleMedia.find((m) => m.media_type === 'image')?.public_url ?? null

  const handleShareNotify = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 2800)
  }

  const handleExport = async () => {
    if (!exportRef.current) return
    setExporting(true)
    try {
      if (dirtyRef.current) {
        const ok = await handleSave()
        if (!ok) return
      }
      await exportNoteAsImage(exportRef.current, title.trim() || 'note')
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" aria-label="加载中" />
      </div>
    )
  }

  return (
    <div className="app-shell editor-page">
      <header className="app-header editor-header">
        <div className="app-header__inner">
          <button type="button" className="icon-btn" onClick={handleBack} aria-label="返回并保存">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="editor-header__actions">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? '导出中' : '导出图片'}
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={handleSaveAndStay} disabled={saving}>
              {saving ? '保存中' : '保存'}
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      <main className="app-main editor-main">
        <div className="content-container editor-container">
          {error && <div className="alert alert--error" role="alert">{error}</div>}
          {notice && <div className="alert alert--success" role="status">{notice}</div>}

          <div ref={exportRef} className="editor-body">
            <input
              type="text"
              className="editor-title"
              placeholder="标题"
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty() }}
            />
            <textarea
              className="editor-content"
              placeholder="开始书写…"
              value={content}
              onChange={(e) => { setContent(e.target.value); markDirty() }}
            />

            {visibleMedia.length > 0 && (
              <div className="media-grid">
                {visibleMedia.map((item) => (
                  <div key={item.id} className="media-item">
                    {item.media_type === 'image' ? (
                      <img src={item.public_url} alt="" />
                    ) : (
                      <video src={item.public_url} controls preload="metadata" />
                    )}
                    <button
                      type="button"
                      className="media-item__remove"
                      onClick={() => removeMedia(item.id)}
                      aria-label="移除媒体"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="editor-toolbar">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files, 'image')
                e.target.value = ''
              }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files, 'video')
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageCount >= MAX_IMAGES}
            >
              图片 ({imageCount}/{MAX_IMAGES})
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => videoInputRef.current?.click()}
              disabled={videoCount >= MAX_VIDEOS}
            >
              视频 ({videoCount}/{MAX_VIDEOS})
            </button>
          </div>
        </div>
      </main>

      <button
        type="button"
        className="fab fab--share"
        onClick={() => setShareOpen(true)}
        aria-label="分享笔记"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <ShareSheet
        open={shareOpen}
        noteId={id}
        userId={user?.id}
        payload={{ title, content }}
        coverUrl={coverUrl}
        exportElement={exportRef.current}
        onPrepareShare={handleSave}
        onClose={() => setShareOpen(false)}
        onNotify={handleShareNotify}
      />
    </div>
  )
}
