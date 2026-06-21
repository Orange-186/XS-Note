export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  cover_url: string | null
  share_token?: string | null
  is_shared?: boolean
  is_pinned: boolean
  is_favorite: boolean
  created_at: string
  updated_at: string
  note_media?: NoteMedia[]
}

export interface NoteMedia {
  id: string
  note_id: string
  user_id: string
  media_type: 'image' | 'video'
  storage_path: string
  public_url: string
  sort_order: number
  created_at: string
}

export interface NoteDraft {
  title: string
  content: string
}

export interface LocalMedia {
  id: string
  file?: File
  media_type: 'image' | 'video'
  public_url: string
  storage_path?: string
  sort_order: number
  isNew?: boolean
  markedForDelete?: boolean
}

export const MAX_IMAGES = 10
export const MAX_VIDEOS = 5
