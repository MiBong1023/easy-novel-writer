import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Novel } from '@/types'

interface Props {
  novel: Novel
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  if (h < 24) return `${h}시간 전`
  if (d < 30) return `${d}일 전`
  return date.toLocaleDateString('ko-KR')
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
    <div className="group relative flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">

      {/* 액션 버튼 */}
      {!editing && (
        <div className="absolute right-3 top-3 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={startEdit}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="제목 수정"
          >
            ✎
          </button>
          <button
            onClick={() => onDelete(novel.id)}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            aria-label="삭제"
          >
            ✕
          </button>
        </div>
      )}

      {/* 카드 본문 */}
      {editing ? (
        <div className="p-5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            className="w-full rounded-lg border border-indigo-400 bg-transparent px-1 text-lg font-bold text-gray-800 focus:outline-none dark:text-gray-100"
          />
        </div>
      ) : (
        <Link to={`/novels/${novel.id}`} className="flex flex-1 flex-col p-5">
          {/* 제목 */}
          <h2 className="mb-2 pr-14 text-lg font-bold leading-snug text-gray-800 transition-colors group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
            {novel.title}
          </h2>

          {/* 설명 */}
          <p className={`mb-4 flex-1 line-clamp-2 text-sm leading-relaxed ${novel.description ? 'text-gray-500 dark:text-gray-400' : 'italic text-gray-300 dark:text-gray-600'}`}>
            {novel.description || '설명 없음'}
          </p>

          {/* 하단 메타 */}
          <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              {novel.episodeCount}화
            </span>
            <span className="text-gray-200 dark:text-gray-700">·</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {timeAgo(novel.updatedAt)}
            </span>
          </div>
        </Link>
      )}
    </div>
  )
}
