import { useState } from 'react'
import { fetchNoteById } from '../hooks/useNotes'
import { canvasToPngFile, captureNoteElement } from '../utils/exportNote'
import { publishNoteShare } from '../utils/publishSharePage'
import {
  buildShareText,
  canNativeShare,
  canShareFiles,
  copyShareText,
  isWechatBrowser,
  nativeShare,
  openQQShare,
  openWeiboShare,
  openTwitterShare,
  shareToWechatMoments,
  type ShareLinkPayload,
  type SharePayload,
} from '../utils/shareNote'

interface ShareSheetProps {
  open: boolean
  noteId?: string
  userId?: string
  payload: SharePayload
  coverUrl?: string | null
  exportElement: HTMLElement | null
  onPrepareShare?: () => Promise<boolean>
  onClose: () => void
  onNotify: (message: string) => void
}

type ShareAction = 'native' | 'wechat' | 'weibo' | 'qq' | 'twitter' | 'copy' | 'image'

const SHARE_OPTIONS: Array<{
  id: ShareAction
  label: string
  color: string
  hidden?: () => boolean
}> = [
  { id: 'native', label: '更多', color: 'var(--color-primary)', hidden: () => !canNativeShare() },
  { id: 'wechat', label: '朋友圈', color: '#07C160' },
  { id: 'weibo', label: '微博', color: '#E6162D' },
  { id: 'qq', label: 'QQ', color: '#12B7F5' },
  { id: 'twitter', label: 'X', color: '#14171A' },
  { id: 'copy', label: '复制', color: 'var(--color-text-secondary)' },
  { id: 'image', label: '图片', color: '#6B7FD7' },
]

function ShareIcon({ id }: { id: ShareAction }) {
  switch (id) {
    case 'native':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'wechat':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8.5 4C5.46 4 3 6.02 3 8.58c0 1.47.78 2.78 2.01 3.68L4.5 14l2.3-1.15c.55.1 1.12.15 1.7.15 3.04 0 5.5-2.02 5.5-4.56S11.54 4 8.5 4zm-1.6 3.1a.75.75 0 110-1.5.75.75 0 010 1.5zm3.2 0a.75.75 0 110-1.5.75.75 0 010 1.5zM15 8.5c-2.76 0-5 1.79-5 4 0 2.21 2.24 4 5 4 .52 0 1.03-.07 1.52-.2L19 17l-.82-2.28c1.05-.75 1.72-1.85 1.72-3.07 0-2.21-2.24-4-5-4zm-1.4 2.6a.6.6 0 110-1.2.6.6 0 010 1.2zm2.8 0a.6.6 0 110-1.2.6.6 0 010 1.2z" />
        </svg>
      )
    case 'weibo':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M10.2 20.5c-4.1 0-7.4-2-7.4-4.4 0-1.2.7-2.3 1.9-3.1-.1-.4-.1-.8 0-1.2C3.2 9.8 5.6 7 8.8 7c2.2 0 4.1 1.2 5.1 3 .9-.3 1.9-.5 2.9-.5 4.1 0 7.4 2 7.4 4.4 0 2.4-3.3 4.4-7.4 4.4-.8 0-1.6-.1-2.3-.3-.9.9-2.2 1.5-3.6 1.5zm-1.4-9.8c-1.8 0-3.2 1.2-3.2 2.7s1.4 2.7 3.2 2.7 3.2-1.2 3.2-2.7-1.4-2.7-3.2-2.7zm7.6 3.4c-.5 0-.9.4-.9.9s.4.9.9.9.9-.4.9-.9-.4-.9-.9-.9z" />
        </svg>
      )
    case 'qq':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3c-4.2 0-7.6 2.6-7.6 5.8 0 1.8 1.2 3.4 3 4.4-.3.9-.9 2.4-1 2.5-.1.2 0 .4.2.5.2.1.5 0 1.9-.8 1 .3 2.1.4 3.2.4 4.2 0 7.6-2.6 7.6-5.8S16.2 3 12 3z" />
        </svg>
      )
    case 'twitter':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.9 3H22l-6.8 7.8L23 21h-6.7l-5.2-6.8L5.2 21H2l7.3-8.4L1 3h6.9l4.7 6.2L18.9 3zm-1.2 16.2h1.8L7.1 4.7H5.2l12.5 14.5z" />
        </svg>
      )
    case 'copy':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 15V6a2 2 0 012-2h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    case 'image':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
          <path d="M21 16l-5-5-4 4-2-2-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

async function buildShareLinkPayload(
  noteId: string | undefined,
  userId: string | undefined,
  payload: SharePayload,
  coverUrl: string | null | undefined,
  onPrepareShare?: () => Promise<boolean>,
): Promise<ShareLinkPayload> {
  if (!noteId || !userId) {
    return {
      ...payload,
      url: window.location.href,
      coverUrl,
    }
  }

  if (onPrepareShare) {
    const ok = await onPrepareShare()
    if (!ok) throw new Error('请先保存笔记后再分享')
  }

  const note = await fetchNoteById(noteId)
  if (!note) throw new Error('笔记不存在')

  const url = await publishNoteShare(note, userId)
  return {
    ...payload,
    url,
    coverUrl: note.cover_url ?? coverUrl,
  }
}

export function ShareSheet({
  open,
  noteId,
  userId,
  payload,
  coverUrl,
  exportElement,
  onPrepareShare,
  onClose,
  onNotify,
}: ShareSheetProps) {
  const [busy, setBusy] = useState<ShareAction | null>(null)
  const [wechatGuideUrl, setWechatGuideUrl] = useState<string | null>(null)

  if (!open) return null

  const visibleOptions = SHARE_OPTIONS.filter((option) => !option.hidden?.())

  const handleShare = async (action: ShareAction) => {
    if (busy) return
    setBusy(action)

    try {
      switch (action) {
        case 'native': {
          const linkPayload = await buildShareLinkPayload(noteId, userId, payload, coverUrl, onPrepareShare)
          await nativeShare(linkPayload)
          onClose()
          break
        }
        case 'wechat': {
          const linkPayload = await buildShareLinkPayload(noteId, userId, payload, coverUrl, onPrepareShare)
          const result = await shareToWechatMoments(linkPayload)
          if (result === 'wechat-guide') {
            setWechatGuideUrl(linkPayload.url)
            onNotify('公开链接已复制，请按提示分享到朋友圈')
            break
          }
          if (result === 'native') {
            onNotify('已唤起系统分享')
            onClose()
            break
          }
          onNotify('公开分享链接已复制，打开微信朋友圈粘贴即可看到标题、摘要和封面')
          onClose()
          break
        }
        case 'weibo': {
          const linkPayload = await buildShareLinkPayload(noteId, userId, payload, coverUrl, onPrepareShare)
          openWeiboShare(linkPayload)
          onClose()
          break
        }
        case 'qq': {
          const linkPayload = await buildShareLinkPayload(noteId, userId, payload, coverUrl, onPrepareShare)
          openQQShare(linkPayload)
          onClose()
          break
        }
        case 'twitter':
          openTwitterShare(payload)
          onClose()
          break
        case 'copy':
          await copyShareText(payload)
          onNotify('已复制到剪贴板')
          onClose()
          break
        case 'image': {
          if (!exportElement) throw new Error('无法生成分享图片')
          const linkPayload = await buildShareLinkPayload(noteId, userId, payload, coverUrl, onPrepareShare)
          const canvas = await captureNoteElement(exportElement)
          const filename = payload.title.trim() || 'note'
          const file = await canvasToPngFile(canvas, filename)

          if (canNativeShare() && canShareFiles()) {
            await nativeShare(linkPayload, file)
            onClose()
            break
          }

          const link = document.createElement('a')
          link.download = file.name
          link.href = canvas.toDataURL('image/png')
          link.click()
          onNotify('图片已保存，可在相册中分享')
          onClose()
          break
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      onNotify(err instanceof Error ? err.message : '分享失败')
    } finally {
      setBusy(null)
    }
  }

  const preview = buildShareText(payload)
  const previewText = preview.length > 120 ? `${preview.slice(0, 120)}…` : preview

  return (
    <>
      <div className="share-sheet-overlay" role="presentation" onClick={onClose}>
        <div
          className="share-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-sheet-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="share-sheet__handle" aria-hidden="true" />
          <h2 id="share-sheet-title" className="share-sheet__title">
            分享到
          </h2>
          <p className="share-sheet__preview">{previewText}</p>
          {noteId && userId && (
            <p className="share-sheet__hint">微信分享将发布公开链接，包含标题、摘要与封面图</p>
          )}

          <div className="share-sheet__grid">
            {visibleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="share-sheet__item"
                disabled={busy !== null}
                onClick={() => handleShare(option.id)}
              >
                <span
                  className="share-sheet__icon"
                  style={{
                    background: option.id === 'copy' || option.id === 'twitter'
                      ? 'var(--color-primary-soft)'
                      : option.color,
                    color: option.id === 'copy' ? 'var(--color-text-secondary)' : '#fff',
                  }}
                >
                  <ShareIcon id={option.id} />
                </span>
                <span className="share-sheet__label">
                  {busy === option.id ? '处理中' : option.label}
                </span>
              </button>
            ))}
          </div>

          <button type="button" className="share-sheet__cancel btn btn--ghost" onClick={onClose}>
            取消
          </button>
        </div>
      </div>

      {wechatGuideUrl && isWechatBrowser() && (
        <div className="wechat-guide-overlay" role="dialog" aria-modal="true">
          <div className="wechat-guide">
            <p className="wechat-guide__tip">链接已复制，点击右上角 <strong>···</strong></p>
            <p className="wechat-guide__tip">选择「分享到朋友圈」即可发布带封面卡片</p>
            <p className="wechat-guide__url">{wechatGuideUrl}</p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => {
                setWechatGuideUrl(null)
                onClose()
              }}
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  )
}
