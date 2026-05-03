import { useEffect, useState } from 'react'

interface Props {
  count: number
  countNoSpace: number
  goal: number
  percent: number
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  onGoalChange: (v: number) => void
  autoConvert: boolean
  onToggleAutoConvert: () => void
  onVersionHistoryOpen: () => void
  onSpellCheck: () => void
  spellCheckActive: boolean
  onFocusMode: () => void
  onFontIncrease: () => void
  onFontDecrease: () => void
  canFontIncrease: boolean
  canFontDecrease: boolean
  onAI: () => void
  aiActive: boolean
}


export default function ProgressBar({
  count, countNoSpace, goal, percent, saveStatus, onGoalChange,
  autoConvert, onToggleAutoConvert, onVersionHistoryOpen,
  onSpellCheck, spellCheckActive, onFocusMode,
  onFontIncrease, onFontDecrease, canFontIncrease, canFontDecrease,
  onAI, aiActive,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(String(goal))
  const [savedVisible, setSavedVisible] = useState(false)

  useEffect(() => {
    if (saveStatus === 'saved') {
      setSavedVisible(true)
      const t = setTimeout(() => setSavedVisible(false), 2000)
      return () => clearTimeout(t)
    }
  }, [saveStatus])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseInt(input, 10)
    if (!isNaN(val)) onGoalChange(val)
    setEditing(false)
  }

  function handleBlur() {
    const val = parseInt(input, 10)
    if (!isNaN(val)) onGoalChange(val)
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-1.5 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3">

        {/* 왼쪽: 글자수 통계 + 저장 상태 */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-400 dark:text-gray-500">
          <span className="text-gray-600 dark:text-gray-300 font-medium">
            {count.toLocaleString()}
          </span>
          /&nbsp;
          {editing ? (
            <form onSubmit={handleSubmit} className="inline">
              <input
                autoFocus
                type="number"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onBlur={handleBlur}
                className="w-20 rounded border border-indigo-300 bg-white px-1 text-xs text-gray-700 focus:outline-none dark:border-indigo-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </form>
          ) : (
            <button
              onClick={() => { setInput(String(goal)); setEditing(true) }}
              className="underline decoration-dotted hover:text-indigo-500"
              title="목표 글자수 변경"
            >
              {goal.toLocaleString()}
            </button>
          )}
          <span>자 ({percent}%)</span>
          <span className="hidden sm:inline text-gray-200 dark:text-gray-700">·</span>
          <span className="hidden sm:inline">공백 제외 {countNoSpace.toLocaleString()}자</span>
          {saveStatus === 'saving' && (
            <>
              <span className="text-gray-200 dark:text-gray-700">·</span>
              <span>저장 중…</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <span className="text-gray-200 dark:text-gray-700">·</span>
              <span className="text-red-500">저장 실패</span>
            </>
          )}
          <span
            className={`ml-1 text-emerald-500 transition-opacity duration-700 dark:text-emerald-400 ${
              savedVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            ✓
          </span>
        </span>

        {/* 오른쪽: 액션 버튼 그룹 */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onSpellCheck}
            title="맞춤법 검사"
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              spellCheckActive
                ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
            }`}
          >
            맞춤법
          </button>
          <button
            onClick={onVersionHistoryOpen}
            title="버전 기록"
            className="hidden sm:block rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            기록
          </button>
          <button
            onClick={onToggleAutoConvert}
            title="자동 변환 (…, —, 스마트 따옴표)"
            className={`hidden sm:block rounded-md border px-2.5 py-1 text-xs transition-colors ${
              autoConvert
                ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600 dark:border-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300'
            }`}
          >
            자동변환
          </button>

          {/* 글자 크기: 데스크탑만 */}
          <div className="hidden sm:block mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <button
            onClick={onFontDecrease}
            disabled={!canFontDecrease}
            title="글자 작게"
            className="hidden sm:block rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            A-
          </button>
          <button
            onClick={onFontIncrease}
            disabled={!canFontIncrease}
            title="글자 크게"
            className="hidden sm:block rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            A+
          </button>

          {/* AI / 집중 모드 구분선 */}
          <div className="hidden sm:block mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

          <button
            onClick={onAI}
            title="AI 글쓰기 보조"
            className={`hidden sm:block rounded-md border px-2.5 py-1 text-xs transition-colors ${
              aiActive
                ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
            }`}
          >
            AI
          </button>
          <button
            onClick={onFocusMode}
            title="집중 모드 (Esc로 나가기)"
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            집중
          </button>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div className="h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-1 rounded-full transition-all duration-500 ${
            percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {percent >= 100 && (
        <p className="mt-1 text-center text-[10px] font-medium text-emerald-500 dark:text-emerald-400">
          🎉 목표 달성!
        </p>
      )}
    </div>
  )
}
