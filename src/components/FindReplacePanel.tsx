import { useEffect, useRef } from 'react'

interface Props {
  query: string
  setQuery: (v: string) => void
  replacement: string
  setReplacement: (v: string) => void
  matchCount: number
  onFindNext: () => void
  onFindPrev: () => void
  onReplace: () => void
  onReplaceAll: () => void
  onClose: () => void
}

export default function FindReplacePanel({
  query, setQuery,
  replacement, setReplacement,
  matchCount,
  onFindNext, onFindPrev,
  onReplace, onReplaceAll,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onFindNext() }
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onFindPrev() }
  }

  return (
    <div
      className="absolute right-4 top-2 z-20 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">찾기 / 바꾸기</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {/* 찾기 */}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="찾기"
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="shrink-0 text-xs text-gray-400 w-10 text-right">
            {query ? `${matchCount}개` : ''}
          </span>
        </div>

        {/* 바꾸기 */}
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder="바꿀 내용"
          className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        {/* 버튼 */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={onFindPrev} className="btn-secondary text-xs">← 이전</button>
          <button onClick={onFindNext} className="btn-secondary text-xs">다음 →</button>
          <button onClick={onReplace} className="btn-secondary text-xs">바꾸기</button>
          <button
            onClick={onReplaceAll}
            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            disabled={!query || matchCount === 0}
          >
            전체 바꾸기
          </button>
        </div>
      </div>
    </div>
  )
}
