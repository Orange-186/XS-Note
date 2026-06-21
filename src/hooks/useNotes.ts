import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LocalMedia, Note, NoteMedia } from '../types/note'
import { mediaIdsInContentOrder } from '../utils/noteContent'
import { removePublishedShare, syncPublishedShare } from '../utils/publishSharePage'

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

export function useNotes(userId: string | undefined) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotes = useCallback(async () => {
    if (!userId) {
      setNotes([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('notes')
      .select('*, note_media(*)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setNotes(sortNotes((data as Note[]) ?? []).map((note) => ({
      ...note,
      note_media: note.note_media?.sort((a, b) => a.sort_order - b.sort_order),
    })))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const deleteNote = async (noteId: string) => {
    const note = notes.find((n) => n.id === noteId)
    if (note?.note_media?.length) {
      const paths = note.note_media.map((m) => m.storage_path)
      await supabase.storage.from('note-media').remove(paths)
    }

    if (note) {
      await removePublishedShare(note.user_id, noteId).catch(() => {})
    }

    const { error: deleteError } = await supabase.from('notes').delete().eq('id', noteId)
    if (deleteError) throw deleteError

    setNotes((prev) => prev.filter((n) => n.id !== noteId))
  }

  const deleteAllNotes = async () => {
    if (!userId || notes.length === 0) return

    for (const note of notes) {
      if (note.note_media?.length) {
        const paths = note.note_media.map((m) => m.storage_path)
        await supabase.storage.from('note-media').remove(paths)
      }
    }

    const { error: deleteError } = await supabase.from('notes').delete().eq('user_id', userId)
    if (deleteError) throw deleteError

    setNotes([])
  }

  return {
    notes,
    loading,
    error,
    fetchNotes,
    deleteNote,
    deleteAllNotes,
  }
}

export async function fetchNoteById(noteId: string): Promise<Note | null> {
  const { data, error } = await supabase
    .from('notes')
    .select('*, note_media(*)')
    .eq('id', noteId)
    .single()

  if (error) return null
  const note = data as Note
  if (note.note_media) {
    note.note_media.sort((a, b) => a.sort_order - b.sort_order)
  }
  return note
}

export async function createNote(userId: string): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userId, title: '', content: '' })
    .select()
    .single()

  if (error) throw error
  return data as Note
}

function applyMediaSortOrder(content: string, media: LocalMedia[]): LocalMedia[] {
  const orderedIds = mediaIdsInContentOrder(content)
  const sortMap = new Map<string, number>()
  orderedIds.forEach((id, index) => sortMap.set(id, index))

  let nextOrder = orderedIds.length
  return media.map((item) => ({
    ...item,
    sort_order: sortMap.has(item.id) ? sortMap.get(item.id)! : nextOrder++,
  }))
}

export async function saveNote(
  noteId: string,
  userId: string,
  title: string,
  content: string,
  media: LocalMedia[],
): Promise<{ note: Note; shareSynced: boolean }> {
  const sortedMedia = applyMediaSortOrder(content, media)
  const activeMedia = sortedMedia.filter((m) => !m.markedForDelete)
  const coverUrl = activeMedia.find((m) => m.media_type === 'image')?.public_url ?? null

  const { error: updateError } = await supabase
    .from('notes')
    .update({
      title: title.trim(),
      content,
      cover_url: coverUrl,
    })
    .eq('id', noteId)

  if (updateError) throw updateError

  const toDelete = sortedMedia.filter((m) => m.markedForDelete && m.storage_path)
  if (toDelete.length) {
    await supabase.storage.from('note-media').remove(toDelete.map((m) => m.storage_path!))
    await supabase.from('note_media').delete().in('id', toDelete.map((m) => m.id))
  }

  const toUpload = sortedMedia.filter((m) => m.isNew && m.file && !m.markedForDelete)
  const uploadedMedia: NoteMedia[] = []

  for (const item of toUpload) {
    const ext = item.file!.name.split('.').pop() || 'bin'
    const path = `${userId}/${noteId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('note-media')
      .upload(path, item.file!, { upsert: false })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage.from('note-media').getPublicUrl(path)

    const { data: mediaRow, error: mediaError } = await supabase
      .from('note_media')
      .insert({
        note_id: noteId,
        user_id: userId,
        media_type: item.media_type,
        storage_path: path,
        public_url: urlData.publicUrl,
        sort_order: item.sort_order,
      })
      .select()
      .single()

    if (mediaError) throw mediaError
    uploadedMedia.push(mediaRow as NoteMedia)
  }

  const saved = await fetchNoteById(noteId)
  if (!saved) throw new Error('保存后无法读取笔记')

  let shareSynced = false
  try {
    shareSynced = await syncPublishedShare(saved, userId)
  } catch {
    shareSynced = false
  }

  return { note: saved, shareSynced }
}
