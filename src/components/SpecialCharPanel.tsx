const CHARS = [
  { label: '“', value: '“' },
  { label: '”', value: '”' },
  { label: '‘', value: '‘' },
  { label: '’', value: '’' },
  { label: '…', value: '…' },
  { label: '—', value: '—' },
  { label: '–', value: '–' },
]

interface Props {
  onInsert: (char: string) => void
}

export default function SpecialCharPanel({ onInsert }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 flex items-center gap-2 border-t border-gray-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">특수문자</span>
      <div className="flex flex-wrap gap-1">
        {CHARS.map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onInsert(value)
            }}
            className="min-w-[2rem] rounded border border-gray-200 bg-white px-2 py-1 text-sm font-mono text-gray-700 transition hover:bg-gray-100 active:scale-95 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
