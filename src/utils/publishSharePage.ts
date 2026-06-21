import { supabase } from '../lib/supabase'
import type { Note } from '../types/note'
import { encodeUtf8 } from './shareContent'

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

export interface PublishedShare {
  /** 微信/社交平台链接卡片 URL（Edge Function，含 OG 标签） */
  cardUrl: string
  /** App 内分享页 URL（游客可读正文） */
  viewUrl: string
  /** Edge Function 是否已部署可用 */
  cardReady: boolean
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

/** 微信链接卡片 URL：Edge Function 返回带 og:title/description/image 的 HTML */
export function buildWechatCardUrl(userId: string, noteId: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '')
  if (!supabaseUrl) {
    throw new Error('Supabase 未配置，无法生成分享链接')
  }
  const token = buildShareToken(userId, noteId)
  return `${supabaseUrl}/functions/v1/note-share/${token}`
}

export function buildAppShareUrl(token: string): string {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${basePath}/share/${token}`
}

/** @deprecated 使用 buildWechatCardUrl */
export function buildPublicShareUrl(userId: string, noteId: string): string {
  return buildWechatCardUrl(userId, noteId)
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

async function probeShareCard(cardUrl: string): Promise<boolean> {
  try {
    const response = await fetch(cardUrl, { method: 'GET', cache: 'no-store' })
    const type = response.headers.get('content-type') ?? ''
    return response.ok && type.includes('text/html')
  } catch {
    return false
  }
}

export async function publishNoteShare(note: Note, userId: string): Promise<PublishedShare> {
  const shared = noteToSharedView(note)
  const base = shareStorageBase(userId, note.id)
  const token = buildShareToken(userId, note.id)
  const jsonBytes = encodeUtf8(JSON.stringify(shared))

  const jsonUpload = await supabase.storage
    .from('note-media')
    .upload(`${base}.json`, jsonBytes, {
      upsert: true,
      contentType: 'application/json; charset=utf-8',
      cacheControl: '300',
    })

  if (jsonUpload.error) throw new Error(jsonUpload.error.message)

  const cardUrl = buildWechatCardUrl(userId, note.id)
  const viewUrl = buildAppShareUrl(token)
  const cardReady = await probeShareCard(cardUrl)

  return { cardUrl, viewUrl, cardReady }
}

export async function fetchPublishedShare(userId: string, noteId: string): Promise<SharedNoteView | null> {
  const path = `${shareStorageBase(userId, noteId)}.json`
  const { data } = supabase.storage.from('note-media').getPublicUrl(path)
  const response = await fetch(`${data.publicUrl}?t=${Date.now()}`)
  if (!response.ok) return null
  const text = await response.text()
  return JSON.parse(text.replace(/^\uFEFF/, '')) as SharedNoteView
}
