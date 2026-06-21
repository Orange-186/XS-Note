import { getContentSummary } from './formatDate'

export interface SharePayload {
  title: string
  content: string
}

export interface ShareLinkPayload extends SharePayload {
  url: string
  coverUrl?: string | null
}

export function buildShareText({ title, content }: SharePayload): string {
  const heading = title.trim() || '无标题'
  const body = content.trim()
  return body ? `${heading}\n\n${body}` : heading
}

export { buildAppShareUrl, buildPublicShareUrl } from './publishSharePage'

export function isWechatBrowser(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent)
}

export async function copyShareText(payload: SharePayload): Promise<void> {
  const text = buildShareText(payload)
  await copyText(text)
}

export async function copyShareLink(url: string): Promise<void> {
  await copyText(url)
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export function openWeiboShare(payload: ShareLinkPayload): void {
  const text = buildShareText(payload)
  const shareUrl = new URL('https://service.weibo.com/share/share.php')
  shareUrl.searchParams.set('title', text)
  shareUrl.searchParams.set('url', payload.url)
  window.open(shareUrl.toString(), '_blank', 'noopener,noreferrer')
}

export function openQQShare(payload: ShareLinkPayload): void {
  const title = payload.title.trim() || '无标题'
  const summary = getContentSummary(payload.content, 120)
  const shareUrl = new URL('https://connect.qq.com/widget/shareqq/index.html')
  shareUrl.searchParams.set('url', payload.url)
  shareUrl.searchParams.set('title', title)
  shareUrl.searchParams.set('summary', summary)
  shareUrl.searchParams.set('pics', payload.coverUrl ?? '')
  window.open(shareUrl.toString(), '_blank', 'noopener,noreferrer')
}

export function openTwitterShare(payload: SharePayload): void {
  const text = buildShareText(payload)
  const shareUrl = new URL('https://twitter.com/intent/tweet')
  shareUrl.searchParams.set('text', text)
  window.open(shareUrl.toString(), '_blank', 'noopener,noreferrer')
}

export function canNativeShare(): boolean {
  return typeof navigator.share === 'function'
}

export async function nativeShare(payload: ShareLinkPayload, file?: File): Promise<void> {
  if (!canNativeShare()) {
    throw new Error('当前设备不支持系统分享')
  }

  const shareData: ShareData = {
    title: payload.title.trim() || 'XS Note',
    text: getContentSummary(payload.content, 80),
    url: payload.url,
  }

  if (file && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ ...shareData, files: [file] })
    return
  }

  await navigator.share(shareData)
}

export function canShareFiles(): boolean {
  if (typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([''], 'test.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

export type WechatShareResult = 'native' | 'wechat-guide' | 'copied'

export async function shareToWechatMoments(payload: ShareLinkPayload): Promise<WechatShareResult> {
  const title = payload.title.trim() || 'XS Note 笔记'
  const description = getContentSummary(payload.content, 80)

  if (canNativeShare()) {
    try {
      await navigator.share({
        title,
        text: description,
        url: payload.url,
      })
      return 'native'
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
    }
  }

  await copyShareLink(payload.url)

  if (isWechatBrowser()) {
    return 'wechat-guide'
  }

  return 'copied'
}
