import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'
import { ShareSheet } from '../components/ShareSheet'
import { WechatSharePanel } from '../components/WechatSharePanel'
import { NoteContentEditor } from '../components/NoteContentEditor'
import { useAuth } from '../contexts/AuthContext'
import { fetchNoteById, saveNote } from '../hooks/useNotes'
import { useTheme } from '../hooks/useTheme'
import type { LocalMedia, NoteMedia } from '../types/note'
import { MAX_IMAGES, MAX_VIDEOS } from '../types/note'
import { appendMissingImageMarkers, blocksToContent, collectReferencedMediaIds, contentToBlocks, insertImageBlock } from '../utils/noteContent'
import { exportNoteAsImage } from '../utils/exportNote'
import type { ShareLinkPayload } from '../utils/shareNote'

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
  const [wechatShare, setWechatShare] = useState<ShareLinkPayload | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const insertImageRef = useRef<(mediaId: string) => void>(() => {})

  useEffect(() => {
    if (!id) return

    fetchNoteById(id).then((note) => {
      if (!note) {
        setError('笔记不存在')
        setLoading(false)
        return
      }
      setTitle(note.title)
      const mappedMedia = mapRemoteMedia(note.note_media)
      const legacyImageIds = mappedMedia
        .filter((m) => m.media_type === 'image')
        .map((m) => m.id)
      const normalizedContent = appendMissingImageMarkers(note.content, legacyImageIds)
      setContent(normalizedContent)
      setMedia(mappedMedia)
      if (normalizedContent !== note.content) {
        dirtyRef.current = true
      }
      setLoading(false)
    })
  }, [id])

  const markDirty = () => {
    dirtyRef.current = true
  }

  const imageCount = media.filter((m) => m.media_type === 'image' && !m.markedForDelete).length
  const videoCount = media.filter((m) => m.media_type === 'video' && !m.markedForDelete).length

  const handleShareNotify = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 2800)
  }, [])

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!id || !user) return false

    while (savingRef.current) {
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }

    savingRef.current = true
    setSaving(true)
    setError(null)

    try {
      const { shareSynced } = await saveNote(id, user.id, title, content, media)
      dirtyRef.current = false
      if (shareSynced) {
        handleShareNotify('公开链接已同步')
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [id, user, title, content, media, handleShareNotify])

  const handlePrepareShare = useCallback(async (): Promise<boolean> => {
    if (!id || !user) return false
    if (!dirtyRef.current) return true
    return handleSave()
  }, [handleSave, id, user])

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

    if (type === 'image') {
      const newItems: LocalMedia[] = selected.map((file, index) => ({
        id: crypto.randomUUID(),
        file,
        media_type: 'image' as const,
        public_url: URL.createObjectURL(file),
        sort_order: media.length + index,
        isNew: true,
      }))

      setMedia((prev) => [...prev, ...newItems])

      if (newItems.length === 1) {
        insertImageRef.current(newItems[0].id)
      } else {
        setContent((prev) => {
          let blocks = contentToBlocks(prev)
          for (const item of newItems) {
            const textIndex = blocks.findIndex((b) => b.type === 'text')
            const targetIndex = textIndex >= 0 ? textIndex : 0
            const cursorPos =
              blocks[targetIndex]?.type === 'text' ? blocks[targetIndex].text.length : 0
            blocks = insertImageBlock(blocks, targetIndex, cursorPos, item.id)
          }
          return blocksToContent(blocks)
        })
      }

      markDirty()
      setError(null)
      return
    }

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

  const handleRemoveInlineMedia = (mediaId: string) => {
    setMedia((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, markedForDelete: true } : m)),
    )
    markDirty()
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
  const referencedIds = collectReferencedMediaIds(content)
  const visibleVideos = visibleMedia.filter((m) => m.media_type === 'video')
  const coverUrl =
    visibleMedia.find((m) => m.media_type === 'image' && referencedIds.has(m.id))?.public_url ??
    visibleMedia.find((m) => m.media_type === 'image')?.public_url ??
    null

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

          <div ref={exportRef} className="editor-body">
            <input
              type="text"
              className="editor-title"
              placeholder="标题"
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty() }}
            />
            <NoteContentEditor
              content={content}
              media={visibleMedia}
              onChange={(next) => { setContent(next); markDirty() }}
              insertImageRef={insertImageRef}
              onRemoveMedia={handleRemoveInlineMedia}
            />

            {visibleVideos.length > 0 && (
              <div className="media-grid">
                {visibleVideos.map((item) => (
                  <div key={item.id} className="media-item">
                    <video src={item.public_url} controls preload="metadata" />
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
              插入图片 ({imageCount}/{MAX_IMAGES})
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
        onPrepareShare={handlePrepareShare}
        onOpenWechatShare={setWechatShare}
        onClose={() => setShareOpen(false)}
        onNotify={handleShareNotify}
      />

      <WechatSharePanel
        open={wechatShare !== null}
        payload={wechatShare}
        onClose={() => setWechatShare(null)}
        onNotify={handleShareNotify}
      />

      {notice && (
        <div className="share-toast" role="status">{notice}</div>
      )}
    </div>
  )
}
