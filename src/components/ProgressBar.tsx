import { useEffect, useRef, useState } from 'react'
import { useTimer } from '@/hooks/useTimer'

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


function getSavedLabel(lastSavedAt: Date | null): string | null {
  if (!lastSavedAt) return null
  const diff = Math.floor((Date.now() - lastSavedAt.getTime()) / 1000)
  if (diff < 60) return '방금 저장'
  const mins = Math.floor(diff / 60)
  if (mins < 60) return `${mins}분 전 저장`
  return null
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
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [, setTick] = useState(0)
  const [justReached, setJustReached] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [timerMenuOpen, setTimerMenuOpen] = useState(false)
  const prevPercentRef = useRef(0)
  const { running: timerRunning, done: timerDone, start: startTimer, stop: stopTimer, mins, secs } = useTimer()

  useEffect(() => {
    if (saveStatus === 'saved') setLastSavedAt(new Date())
  }, [saveStatus])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (percent >= 100 && prevPercentRef.current < 100) {
      setJustReached(true)
      const t = setTimeout(() => setJustReached(false), 3000)
      return () => clearTimeout(t)
    }
    prevPercentRef.current = percent
  }, [percent])

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
    <div className="relative flex flex-col gap-1.5 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
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
          {saveStatus !== 'saving' && getSavedLabel(lastSavedAt) && (
            <>
              <span className="text-gray-200 dark:text-gray-700">·</span>
              <span className="text-emerald-500 dark:text-emerald-400">{getSavedLabel(lastSavedAt)}</span>
            </>
          )}
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

          {/* 집중 타이머 */}
          <div className="relative hidden sm:block">
            {timerRunning ? (
              <div className="flex items-center gap-1">
                <span className={`tabular-nums text-xs font-medium ${mins === 0 && secs <= 30 ? 'animate-pulse text-red-500' : 'text-indigo-500 dark:text-indigo-400'}`}>
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
                <button
                  onClick={stopTimer}
                  title="타이머 정지"
                  className="rounded-md border border-gray-200 px-1.5 py-1 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  ■
                </button>
              </div>
            ) : timerDone ? (
              <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">✓ 완료!</span>
            ) : (
              <>
                <button
                  onClick={() => setTimerMenuOpen((v) => !v)}
                  title="집중 타이머"
                  className="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  ⏱
                </button>
                {timerMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTimerMenuOpen(false)} />
                    <div className="absolute bottom-full right-0 z-20 mb-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                      {[15, 25, 50].map((m) => (
                        <button
                          key={m}
                          onClick={() => { startTimer(m); setTimerMenuOpen(false) }}
                          className="flex w-full items-center justify-between gap-4 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <span>{m}분</span>
                          <span className="text-xs text-gray-400">{m === 25 ? '포모도로' : ''}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <button
            onClick={onAI}
            title="AI 글쓰기 보조"
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
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

          {/* 모바일 전용 ⋯ 메뉴 */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="sm:hidden rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ⋯
          </button>
        </div>
      </div>

      {/* 모바일 오버플로우 드롭다운 */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-3 top-10 z-20 min-w-[170px] rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={() => { onVersionHistoryOpen(); setMobileMenuOpen(false) }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              버전 기록
            </button>
            <button
              onClick={() => { onToggleAutoConvert(); setMobileMenuOpen(false) }}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              자동변환
              {autoConvert && <span className="text-xs text-indigo-500">ON</span>}
            </button>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-600 dark:text-gray-300">글자 크기</span>
              <div className="flex items-center gap-1">
                <button onClick={onFontDecrease} disabled={!canFontDecrease} className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700">A-</button>
                <button onClick={onFontIncrease} disabled={!canFontIncrease} className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700">A+</button>
              </div>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700" />
            {timerRunning ? (
              <button
                onClick={() => { stopTimer(); setMobileMenuOpen(false) }}
                className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span>타이머 정지</span>
                <span className="tabular-nums text-xs font-medium">{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</span>
              </button>
            ) : (
              <div>
                <p className="px-4 pt-2.5 pb-1 text-xs text-gray-400 dark:text-gray-500">집중 타이머</p>
                <div className="flex gap-1 px-4 pb-2.5">
                  {[15, 25, 50].map((m) => (
                    <button
                      key={m}
                      onClick={() => { startTimer(m); setMobileMenuOpen(false) }}
                      className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-indigo-950"
                    >
                      {m}분
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 프로그레스 바 */}
      <div className={`h-1 w-full rounded-full bg-gray-100 transition-all dark:bg-gray-800 ${justReached ? 'ring-2 ring-emerald-300 ring-offset-1 dark:ring-emerald-700' : ''}`}>
        <div
          className={`h-1 rounded-full transition-all duration-500 ${
            percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
          } ${justReached ? 'animate-pulse' : ''}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      {percent >= 100 && (
        <p className={`mt-1 text-center text-[10px] font-medium text-emerald-500 dark:text-emerald-400 ${justReached ? 'animate-bounce' : ''}`}>
          🎉 목표 달성!
        </p>
      )}
    </div>
  )
}
