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
  const findRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    findRef.current?.focus()
  }, [])

  function onFindKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        onFindPrev()
      } else {
        onFindNext()
      }
      // textarea가 포커스를 가져가므로 즉시 되돌림
      requestAnimationFrame(() => findRef.current?.focus())
    }
  }

  function onReplaceKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      onReplace()
      // replaceCurrent 내부 RAF(textarea 선택) 이후에 replace 입력창으로 복귀
      requestAnimationFrame(() => requestAnimationFrame(() => replaceRef.current?.focus()))
    }
  }

  return (
    <div className="absolute right-4 top-2 z-20 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
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
        {/* 찾기 — Enter: 다음, Shift+Enter: 이전 */}
        <div className="flex items-center gap-2">
          <input
            ref={findRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onFindKeyDown}
            placeholder="찾기 (Enter: 다음, Shift+Enter: 이전)"
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="w-10 shrink-0 text-right text-xs text-gray-400">
            {query ? `${matchCount}개` : ''}
          </span>
        </div>

        {/* 바꾸기 — Enter: 바꾸기 + 다음으로 이동 */}
        <input
          ref={replaceRef}
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={onReplaceKeyDown}
          placeholder="바꿀 내용 (Enter: 바꾸기)"
          className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />

        {/* 버튼 */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={onFindPrev} disabled={!matchCount} className="btn-secondary text-xs disabled:opacity-40">← 이전</button>
          <button onClick={onFindNext} disabled={!matchCount} className="btn-secondary text-xs disabled:opacity-40">다음 →</button>
          <button onClick={onReplace} disabled={!matchCount} className="btn-secondary text-xs disabled:opacity-40">바꾸기</button>
          <button
            onClick={onReplaceAll}
            disabled={!query || matchCount === 0}
            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            전체 바꾸기
          </button>
        </div>
      </div>
    </div>
  )
}
