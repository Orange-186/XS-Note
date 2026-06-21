import { supabase } from '../lib/supabase'
import type { Note } from '../types/note'
import { getContentSummary } from './formatDate'

export interface SharedNoteView {
  title: string
  content: string
  cover_url: string | null
  updated_at: string
  note_media: Array<{
    media_type: 'image' | 'video'
    public_url: string
    sort_order: number
  }>
}

export function buildShareToken(userId: string, noteId: string): string {
  return `${userId}_${noteId}`
}

export function parseShareToken(token: string): { userId: string; noteId: string } | null {
  const match = token.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  )
  if (!match) return null
  return { userId: match[1], noteId: match[2] }
}

function shareStorageBase(userId: string, noteId: string): string {
  return `${userId}/shares/${noteId}`
}

export function buildPublicShareUrl(userId: string, noteId: string): string {
  const path = `${shareStorageBase(userId, noteId)}.html`
  const { data } = supabase.storage.from('note-media').getPublicUrl(path)
  return data.publicUrl
}

export function buildAppShareUrl(token: string): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${basePath}/share/${token}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function pickCover(note: SharedNoteView, fallback: string): string {
  if (note.cover_url) return note.cover_url
  const image = note.note_media.find((item) => item.media_type === 'image')
  return image?.public_url || fallback
}

function defaultCoverUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}og-default.png`
}

function renderShareHtml(
  note: SharedNoteView,
  shareUrl: string,
  appShareUrl: string,
): string {
  const title = note.title.trim() || '无标题'
  const description = getContentSummary(note.content, 120)
  const image = pickCover(note, defaultCoverUrl())
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)
  const safeContent = escapeHtml(note.content.trim() || '暂无正文').replace(/\n/g, '<br />')
  const safeImage = escapeHtml(image)
  const safeShareUrl = escapeHtml(shareUrl)
  const safeAppShareUrl = escapeHtml(appShareUrl)

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="XS Note" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${safeImage}" />
  <meta property="og:url" content="${safeShareUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${safeImage}" />
  <meta itemprop="name" content="${safeTitle}" />
  <meta itemprop="description" content="${safeDescription}" />
  <meta itemprop="image" content="${safeImage}" />
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f1f3f2; color: #1e2d2c; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 24px rgba(30,45,44,.08); }
    .cover { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #e8efec; }
    .body { padding: 20px; }
    .brand { font-size: 12px; letter-spacing: .08em; color: #18924d; margin-bottom: 8px; }
    h1 { margin: 0 0 12px; font-size: 24px; line-height: 1.35; }
    .summary { margin: 0 0 16px; color: rgba(30,45,44,.65); line-height: 1.7; }
    .content { white-space: pre-wrap; line-height: 1.8; }
    .link { display: inline-block; margin-top: 20px; color: #18924d; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrap">
    <article class="card">
      <img class="cover" src="${safeImage}" alt="${safeTitle}" />
      <div class="body">
        <div class="brand">XS NOTE</div>
        <h1>${safeTitle}</h1>
        <p class="summary">${safeDescription}</p>
        <div class="content">${safeContent}</div>
        <a class="link" href="${safeAppShareUrl}">在 XS Note 中查看</a>
      </div>
    </article>
  </div>
</body>
</html>`
}

function noteToSharedView(note: Note): SharedNoteView {
  return {
    title: note.title,
    content: note.content,
    cover_url: note.cover_url,
    updated_at: note.updated_at,
    note_media: (note.note_media ?? []).map((item) => ({
      media_type: item.media_type,
      public_url: item.public_url,
      sort_order: item.sort_order,
    })),
  }
}

export async function publishNoteShare(note: Note, userId: string): Promise<string> {
  const shared = noteToSharedView(note)
  const base = shareStorageBase(userId, note.id)
  const shareUrl = buildPublicShareUrl(userId, note.id)
  const appShareUrl = buildAppShareUrl(buildShareToken(userId, note.id))
  const html = renderShareHtml(shared, shareUrl, appShareUrl)

  const jsonBlob = new Blob([JSON.stringify(shared)], { type: 'application/json' })
  const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' })

  const jsonUpload = await supabase.storage
    .from('note-media')
    .upload(`${base}.json`, jsonBlob, { upsert: true, contentType: 'application/json', cacheControl: '300' })

  if (jsonUpload.error) throw new Error(jsonUpload.error.message)

  const htmlUpload = await supabase.storage
    .from('note-media')
    .upload(`${base}.html`, htmlBlob, { upsert: true, contentType: 'text/html;charset=utf-8', cacheControl: '300' })

  if (htmlUpload.error) throw new Error(htmlUpload.error.message)

  return shareUrl
}

export async function fetchPublishedShare(userId: string, noteId: string): Promise<SharedNoteView | null> {
  const path = `${shareStorageBase(userId, noteId)}.json`
  const { data } = supabase.storage.from('note-media').getPublicUrl(path)
  const response = await fetch(`${data.publicUrl}?t=${Date.now()}`)
  if (!response.ok) return null
  return response.json() as Promise<SharedNoteView>
}
