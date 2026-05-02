import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Novel } from '@/types'

interface Props {
  novel: Novel
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

export default function NovelCard({ novel, onDelete, onRename }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(novel.title)
    setEditing(true)
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
  }

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== novel.title) onRename(novel.id, trimmed)
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="mb-1 w-full rounded-lg border border-indigo-400 bg-transparent px-1 text-lg font-semibold text-gray-800 focus:outline-none dark:text-gray-100"
        />
      ) : (
        <Link to={`/novels/${novel.id}`} className="block">
          <h2 className="mb-1 text-lg font-semibold text-gray-800 group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
            {novel.title}
          </h2>
          <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
            {novel.description || '설명 없음'}
          </p>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            {novel.episodeCount}화 · {new Date(novel.updatedAt).toLocaleDateString('ko-KR')}
          </p>
        </Link>
      )}
      {!editing && (
        <button
          onClick={startEdit}
          className="absolute right-8 top-3 rounded p-1 text-gray-300 opacity-0 transition hover:text-gray-600 group-hover:opacity-100 dark:text-gray-600 dark:hover:text-gray-300"
          aria-label="제목 수정"
        >
          ✎
        </button>
      )}
      <button
        onClick={() => onDelete(novel.id)}
        className="absolute right-3 top-3 rounded p-1 text-gray-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100 dark:text-gray-600"
        aria-label="삭제"
      >
        ✕
      </button>
    </div>
  )
}
