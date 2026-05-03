import { useRef, useState } from 'react'
import type { Novel, NovelColor } from '@/types'
import { NOVEL_COLORS } from '@/types'

interface Props {
  novel: Novel
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onColorChange: (id: string, color: NovelColor) => void
  onCardClick: (id: string) => void
}

const COLOR_STYLES: Record<NovelColor, { bar: string; badge: string; dot: string }> = {
  indigo:  { bar: 'bg-indigo-400',  badge: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',  dot: 'bg-indigo-400' },
  rose:    { bar: 'bg-rose-400',    badge: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400',          dot: 'bg-rose-400' },
  emerald: { bar: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400', dot: 'bg-emerald-400' },
  amber:   { bar: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',      dot: 'bg-amber-400' },
  violet:  { bar: 'bg-violet-400',  badge: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',  dot: 'bg-violet-400' },
  sky:     { bar: 'bg-sky-400',     badge: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',              dot: 'bg-sky-400' },
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

export default function NovelCard({ novel, onDelete, onRename, onColorChange, onCardClick }: Props) {
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

  const color = novel.color ?? 'indigo'
  const styles = COLOR_STYLES[color]

  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 overflow-hidden">

      {/* 컬러 상단 바 — 호버 시 확장되며 색상 선택 노출 */}
      <div className={`relative flex h-1.5 w-full items-center justify-center transition-all duration-200 group-hover:h-9 ${styles.bar}`}>
        <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {NOVEL_COLORS.map((c) => (
            <button
              key={c}
              onClick={(e) => { e.stopPropagation(); onColorChange(novel.id, c) }}
              className={`h-4 w-4 rounded-full border-2 transition-transform hover:scale-125 ${COLOR_STYLES[c].dot} ${c === color ? 'border-white shadow-sm' : 'border-transparent'}`}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      {/* 액션 버튼 (✎ ✕) */}
      {!editing && (
        <div className="absolute right-3 top-11 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); startEdit() }}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            aria-label="제목 수정"
          >
            ✎
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(novel.id) }}
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
        <div onClick={() => onCardClick(novel.id)} className="flex flex-1 cursor-pointer flex-col p-5">
          {/* 제목 */}
          <h2 className="mb-2 pr-16 text-lg font-bold leading-snug text-gray-800 transition-colors group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
            {novel.title}
          </h2>

          {/* 설명 */}
          <p className={`mb-4 flex-1 line-clamp-2 text-sm leading-relaxed ${novel.description ? 'text-gray-500 dark:text-gray-400' : 'italic text-gray-300 dark:text-gray-600'}`}>
            {novel.description || '설명 없음'}
          </p>

          {/* 하단 메타 */}
          <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}>
              {novel.episodeCount}화
            </span>
            <span className="text-gray-200 dark:text-gray-700">·</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {timeAgo(novel.updatedAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
