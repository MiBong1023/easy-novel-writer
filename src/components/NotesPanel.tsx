import { useRef, useState } from 'react'
import { useNotes, type Note } from '@/hooks/useNotes'

interface Props {
  novelId: string
  userId: string
  onClose: () => void
}

export default function NotesPanel({ novelId, userId, onClose }: Props) {
  const { notes, loading, addNote, updateNote, deleteNote, togglePin } = useNotes(novelId, userId)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [noteSearch, setNoteSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({})
  const addRef = useRef<HTMLInputElement>(null)

  function getDraft(note: Note) {
    return drafts[note.id] ?? { title: note.title, body: note.body }
  }

  function setDraft(id: string, changes: Partial<{ title: string; body: string }>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...getDraft({ id } as Note), ...changes } }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const t = newTitle.trim()
    if (!t) return
    const note = await addNote(t)
    setNewTitle('')
    setExpandedId(note.id)
  }

  function handleExpand(note: Note) {
    if (expandedId === note.id) {
      const draft = drafts[note.id]
      if (draft) updateNote(note.id, draft)
      setExpandedId(null)
    } else {
      setExpandedId(note.id)
    }
  }

  function handleBlurField(note: Note) {
    const draft = drafts[note.id]
    if (draft) updateNote(note.id, draft)
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await deleteNote(id)
    if (expandedId === id) setExpandedId(null)
  }

  const displayed = notes
    .filter((n) => {
      if (!noteSearch.trim()) return true
      const q = noteSearch.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    })

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">작품 메모</span>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* 새 메모 추가 */}
      <form onSubmit={handleAdd} className="border-b border-gray-100 px-3 py-2 dark:border-gray-700">
        <div className="flex gap-1">
          <input
            ref={addRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="새 메모 제목…"
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            추가
          </button>
        </div>
      </form>

      {/* 메모 검색 */}
      {notes.length >= 3 && (
        <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-700">
          <input
            type="search"
            value={noteSearch}
            onChange={(e) => setNoteSearch(e.target.value)}
            placeholder="메모 검색…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-600"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="mt-12 text-center text-sm text-gray-400">불러오는 중…</div>
        ) : notes.length === 0 ? (
          <div className="mt-12 px-4 text-center text-sm text-gray-400">
            <p className="mb-2 text-2xl">🗒️</p>
            <p>메모가 없어요.</p>
            <p className="mt-1 text-xs">인물 설정, 플롯 메모 등을 저장하세요.</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="mt-8 px-4 text-center text-xs text-gray-400">"{noteSearch}"에 해당하는 메모가 없어요.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {displayed.map((note) => {
              const draft = getDraft(note)
              const open = expandedId === note.id
              return (
                <li key={note.id} className="group">
                  {/* 제목 행 */}
                  <div
                    className="flex cursor-pointer items-center gap-1 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => handleExpand(note)}
                  >
                    {/* 고정 핀 버튼 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(note.id) }}
                      title={note.pinned ? '고정 해제' : '메모 고정'}
                      className={`shrink-0 rounded p-0.5 text-xs transition-opacity ${
                        note.pinned
                          ? 'text-amber-400 opacity-100'
                          : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:text-amber-400 dark:text-gray-600'
                      }`}
                    >
                      📌
                    </button>
                    <span className="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                      {draft.title || '(제목 없음)'}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, note.id)}
                      className="shrink-0 rounded p-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:text-gray-600"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                    <span className="shrink-0 text-xs text-gray-300 dark:text-gray-600">{open ? '▲' : '▼'}</span>
                  </div>

                  {/* 펼쳐진 편집 영역 */}
                  {open && (
                    <div className="px-4 pb-3 pt-1">
                      <input
                        value={draft.title}
                        onChange={(e) => setDraft(note.id, { title: e.target.value })}
                        onBlur={() => handleBlurField(note)}
                        placeholder="제목"
                        className="mb-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <textarea
                        value={draft.body}
                        onChange={(e) => setDraft(note.id, { body: e.target.value })}
                        onBlur={() => handleBlurField(note)}
                        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.blur() }}
                        placeholder="내용을 입력하세요… (Cmd+Enter로 저장)"
                        rows={6}
                        className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs leading-relaxed focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
