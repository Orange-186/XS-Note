import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NoteCard } from '../components/NoteCard'
import { ThemeToggle } from '../components/ThemeToggle'
import { createNote } from '../hooks/useNotes'
import { useNotes } from '../hooks/useNotes'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../hooks/useTheme'

export function HomePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { notes, loading, error, deleteNote, deleteAllNotes } = useNotes(user?.id)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [creating, setCreating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!user || creating) return
    setCreating(true)
    setActionError(null)
    try {
      const note = await createNote(user.id)
      navigate(`/note/${note.id}`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setActionError(null)
    try {
      await deleteNote(id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleDeleteAll = async () => {
    setActionError(null)
    try {
      await deleteAllNotes()
      setShowDeleteAll(false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="app-shell home-page">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__brand">
            <h1 className="app-header__title">XS Note</h1>
          </div>
          <div className="app-header__actions">
            {notes.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setShowDeleteAll(true)}
              >
                全部删除
              </button>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => signOut()}>
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="content-container">
          {(error || actionError) && (
            <div className="alert alert--error" role="alert">
              {error || actionError}
            </div>
          )}

          {loading ? (
            <div className="page-loading page-loading--inline">
              <div className="spinner" aria-label="加载中" />
            </div>
          ) : notes.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">还没有笔记</p>
              <p className="empty-state__desc">点击右下角按钮，开始记录第一条想法</p>
            </div>
          ) : (
            <ul className="note-list">
              {notes.map((note) => (
                <li key={note.id}>
                  <NoteCard
                    note={note}
                    onDelete={handleDelete}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <button
        type="button"
        className="fab"
        onClick={handleCreate}
        disabled={creating}
        aria-label="创建笔记"
      >
        {creating ? '…' : '+'}
      </button>

      <ConfirmDialog
        open={showDeleteAll}
        title="删除全部笔记"
        message="此操作不可恢复，确定要删除所有笔记及其媒体文件吗？"
        confirmLabel="全部删除"
        onConfirm={handleDeleteAll}
        onCancel={() => setShowDeleteAll(false)}
      />
    </div>
  )
}
