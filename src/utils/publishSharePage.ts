import { supabase } from '../lib/supabase'
import type { Note } from '../types/note'
import { encodeUtf8 } from './shareContent'

export interface SharedNoteView {
  title: string
  content: string
  cover_url: string | null
  updated_at: string
  note_media: Array<{
    id?: string
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
      id: item.id,
      media_type: item.media_type,
      public_url: item.public_url,
      sort_order: item.sort_order,
    })),
  }
}

function shareJsonPath(userId: string, noteId: string): string {
  return `${shareStorageBase(userId, noteId)}.json`
}

const SHARED_NOTES_STORAGE_KEY = 'xs-note-shared-notes'

function readSharedNoteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SHARED_NOTES_STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function markNoteAsPubliclyShared(noteId: string): void {
  try {
    const ids = readSharedNoteIds()
    if (ids.has(noteId)) return
    ids.add(noteId)
    localStorage.setItem(SHARED_NOTES_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore quota / private mode
  }
}

export function clearNotePublicShareMark(noteId: string): void {
  try {
    const ids = readSharedNoteIds()
    if (!ids.has(noteId)) return
    ids.delete(noteId)
    localStorage.setItem(SHARED_NOTES_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

async function shareJsonExists(userId: string, noteId: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from('note-media')
    .list(`${userId}/shares`, { limit: 100 })
  if (error) return false
  return data.some((item) => item.name === `${noteId}.json`)
}

async function uploadShareJson(note: Note, userId: string): Promise<void> {
  const shared = noteToSharedView(note)
  const jsonPath = shareJsonPath(userId, note.id)
  const jsonBytes = encodeUtf8(JSON.stringify(shared))

  await supabase.storage.from('note-media').remove([jsonPath])

  const jsonUpload = await supabase.storage
    .from('note-media')
    .upload(jsonPath, jsonBytes, {
      contentType: 'application/json; charset=utf-8',
      cacheControl: '60',
    })

  if (jsonUpload.error) throw new Error(`发布分享失败：${jsonUpload.error.message}`)
}

/** 若笔记已公开分享，则同步最新内容到 Storage */
export async function syncPublishedShare(note: Note, userId: string): Promise<boolean> {
  const markedShared = readSharedNoteIds().has(note.id)
  if (!markedShared && !(await shareJsonExists(userId, note.id))) {
    return false
  }

  await uploadShareJson(note, userId)
  markNoteAsPubliclyShared(note.id)
  return true
}

export async function removePublishedShare(userId: string, noteId: string): Promise<void> {
  await supabase.storage.from('note-media').remove([shareJsonPath(userId, noteId)])
  clearNotePublicShareMark(noteId)
}

async function probeShareCard(cardUrl: string): Promise<boolean> {
  try {
    const response = await Promise.race([
      fetch(cardUrl, { method: 'GET', cache: 'no-store' }),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('timeout')), 3000)
      }),
    ])
    const type = response.headers.get('content-type') ?? ''
    return response.ok && type.includes('text/html')
  } catch {
    return false
  }
}

export async function publishNoteShare(note: Note, userId: string): Promise<PublishedShare> {
  await uploadShareJson(note, userId)
  markNoteAsPubliclyShared(note.id)

  const token = buildShareToken(userId, note.id)
  const cardUrl = buildWechatCardUrl(userId, note.id)
  const viewUrl = buildAppShareUrl(token)
  const cardReady = await probeShareCard(cardUrl)

  return { cardUrl, viewUrl, cardReady }
}

export async function fetchPublishedShare(userId: string, noteId: string): Promise<SharedNoteView | null> {
  const path = shareJsonPath(userId, noteId)
  const { data } = supabase.storage.from('note-media').getPublicUrl(path)
  const response = await fetch(`${data.publicUrl}?t=${Date.now()}`)
  if (!response.ok) return null
  const text = await response.text()
  return JSON.parse(text.replace(/^\uFEFF/, '')) as SharedNoteView
}
