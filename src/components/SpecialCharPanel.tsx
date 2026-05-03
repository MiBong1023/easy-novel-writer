import { useState } from 'react'

interface CharItem { label: string; value: string }

const DEFAULT_CHARS: CharItem[] = [
  { label: '“', value: '“' },
  { label: '”', value: '”' },
  { label: '‘', value: '‘' },
  { label: '’', value: '’' },
  { label: '…', value: '…' },
  { label: '—', value: '—' },
  { label: '–', value: '–' },
]

function loadChars(): CharItem[] {
  try {
    const stored = localStorage.getItem('specialChars')
    if (stored) return JSON.parse(stored) as CharItem[]
  } catch {}
  return DEFAULT_CHARS
}

interface Props {
  onInsert: (char: string) => void
}

export default function SpecialCharPanel({ onInsert }: Props) {
  const [chars, setChars] = useState<CharItem[]>(loadChars)
  const [editMode, setEditMode] = useState(false)
  const [addValue, setAddValue] = useState('')

  function saveChars(next: CharItem[]) {
    setChars(next)
    localStorage.setItem('specialChars', JSON.stringify(next))
  }

  function removeChar(idx: number) {
    saveChars(chars.filter((_, i) => i !== idx))
  }

  function addChar() {
    const v = addValue.trim()
    if (!v) return
    saveChars([...chars, { label: v, value: v }])
    setAddValue('')
  }

  function onAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addChar() }
    if (e.key === 'Escape') setEditMode(false)
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-950">
      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">특수문자</span>
      <div className="flex flex-1 flex-wrap gap-1">
        {chars.map(({ label, value }, idx) => (
          <div key={idx} className="relative">
            <button
              type="button"
              onMouseDown={editMode ? undefined : (e) => { e.preventDefault(); onInsert(value) }}
              className="min-w-[2rem] rounded border border-gray-200 bg-white px-2 py-1 text-sm font-mono text-gray-700 transition hover:bg-gray-100 active:scale-95 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {label}
            </button>
            {editMode && (
              <button
                onClick={() => removeChar(idx)}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white hover:bg-red-600"
                aria-label="삭제"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {editMode && (
          <input
            autoFocus
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={onAddKeyDown}
            placeholder="추가"
            maxLength={4}
            className="w-16 rounded border border-indigo-300 bg-white px-2 py-1 text-sm focus:outline-none dark:border-indigo-600 dark:bg-gray-800 dark:text-gray-200"
          />
        )}
      </div>
      <button
        onClick={() => { setEditMode((v) => !v); setAddValue('') }}
        title={editMode ? '편집 완료' : '특수문자 편집'}
        className={`shrink-0 rounded px-1.5 py-1 text-xs transition ${editMode ? 'text-indigo-500' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
      >
        {editMode ? '완료' : '✎'}
      </button>
    </div>
  )
}
