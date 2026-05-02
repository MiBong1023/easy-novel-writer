import { useState } from 'react'

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
}

const STATUS_TEXT: Record<Props['saveStatus'], string> = {
  idle: '',
  saving: '저장 중…',
  saved: '저장됨',
  error: '저장 실패',
}

export default function ProgressBar({ count, countNoSpace, goal, percent, saveStatus, onGoalChange, autoConvert, onToggleAutoConvert, onVersionHistoryOpen }: Props) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(String(goal))

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
    <div className="flex flex-col gap-1 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1 flex-wrap">
          {count.toLocaleString()} /&nbsp;
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
          &nbsp;자 ({percent}%)
          <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
          <span className="text-gray-400 dark:text-gray-500">공백 제외 {countNoSpace.toLocaleString()}자</span>
        </span>
        <span className="flex items-center gap-3">
          <button
            onClick={onVersionHistoryOpen}
            title="버전 기록"
            className="text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            기록
          </button>
          <button
            onClick={onToggleAutoConvert}
            title="자동 변환 (…, —, 스마트 따옴표)"
            className={`transition ${autoConvert ? 'text-indigo-500' : 'text-gray-300 dark:text-gray-600'}`}
          >
            자동변환
          </button>
          <span className={saveStatus === 'error' ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}>
            {STATUS_TEXT[saveStatus]}
          </span>
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-1 rounded-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
