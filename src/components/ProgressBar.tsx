interface Props {
  count: number
  goal: number
  percent: number
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
}

const STATUS_TEXT: Record<Props['saveStatus'], string> = {
  idle: '',
  saving: '저장 중…',
  saved: '저장됨',
  error: '저장 실패',
}

export default function ProgressBar({ count, goal, percent, saveStatus }: Props) {
  return (
    <div className="flex flex-col gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {count.toLocaleString()} / {goal.toLocaleString()}자 ({percent}%)
        </span>
        <span className={saveStatus === 'error' ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}>
          {STATUS_TEXT[saveStatus]}
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
