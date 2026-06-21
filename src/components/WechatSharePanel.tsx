import { useEffect } from 'react'
import { getContentSummary } from '../utils/formatDate'
import { canNativeShare, copyShareLink, isWechatBrowser, nativeShare, type ShareLinkPayload } from '../utils/shareNote'

interface WechatSharePanelProps {
  open: boolean
  payload: ShareLinkPayload | null
  onClose: () => void
  onNotify: (message: string) => void
}

export function WechatSharePanel({ open, payload, onClose, onNotify }: WechatSharePanelProps) {
  const inWechat = isWechatBrowser()

  useEffect(() => {
    if (!open || !payload) return
    copyShareLink(payload.url).catch(() => {})
  }, [open, payload])

  if (!open || !payload) return null

  const title = payload.title.trim() || '无标题'
  const summary = getContentSummary(payload.content, 120)
  const cover = payload.coverUrl || `${window.location.origin}${import.meta.env.BASE_URL}og-default.png`

  const handleCopy = async () => {
    try {
      await copyShareLink(payload.url)
      onNotify(inWechat ? '链接已复制，请点右上角 ··· 分享到朋友圈' : '链接已复制，打开微信粘贴分享')
    } catch {
      onNotify('复制失败，请长按下方链接手动复制')
    }
  }

  const handleNativeShare = async () => {
    try {
      await nativeShare(payload)
      onClose()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      onNotify(err instanceof Error ? err.message : '分享失败')
    }
  }

  const handleOpenPreview = () => {
    window.open(payload.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="wechat-share-overlay" role="presentation" onClick={onClose}>
      <div
        className="wechat-share-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wechat-share-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="wechat-share-title" className="wechat-share-panel__title">
          分享到朋友圈
        </h2>

        <p className="wechat-share-panel__subtitle">
          {payload.cardReady
            ? '链接卡片预览（标题 · 摘要 · 封面）'
            : '阅读链接（微信卡片需部署分享服务后生效）'}
        </p>

        <article className="wechat-share-card">
          <img className="wechat-share-card__cover" src={cover} alt="" />
          <div className="wechat-share-card__body">
            <h3 className="wechat-share-card__title">{title}</h3>
            <p className="wechat-share-card__summary">{summary}</p>
          </div>
        </article>

        <p className="wechat-share-panel__url">{payload.url}</p>

        {inWechat ? (
          <p className="wechat-share-panel__tip">
            {payload.cardReady
              ? <>链接已复制。点击右上角 <strong>···</strong> →「分享到朋友圈」，粘贴链接即可显示上方卡片。</>
              : <>链接已复制。粘贴到朋友圈后可直接阅读正文；带封面卡片需管理员部署分享服务。</>}
          </p>
        ) : (
          <p className="wechat-share-panel__tip">
            {payload.cardReady
              ? '链接已复制。打开微信 → 朋友圈 → 粘贴链接，即可显示带封面、标题和摘要的卡片。'
              : '链接已复制。打开链接可阅读正文；微信朋友圈卡片预览需部署分享服务。'}
          </p>
        )}

        <div className="wechat-share-panel__actions">
          <button type="button" className="btn btn--primary btn--block" onClick={handleCopy}>
            复制分享链接
          </button>
          {canNativeShare() && (
            <button type="button" className="btn btn--ghost btn--block" onClick={handleNativeShare}>
              系统分享
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--block" onClick={handleOpenPreview}>
            预览分享页
          </button>
          {payload.viewUrl && (
            <a className="btn btn--ghost btn--block" href={payload.viewUrl} target="_blank" rel="noopener noreferrer">
              在 XS Note 中阅读
            </a>
          )}
          <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
