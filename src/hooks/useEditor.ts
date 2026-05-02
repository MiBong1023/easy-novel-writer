import { useCallback, useRef } from 'react'

const SPECIAL_RULES: [RegExp, string | ((m: string) => string)][] = [
  [/\.{3}$/, '…'],
  [/-{2}$/, '—'],
]

// Tracks whether we're inside an open double-quote so we can pick " vs "
let openDoubleQuote = false

function transformTyping(text: string, inserted: string): string {
  if (inserted !== ' ' && inserted !== '\n') return text

  // Check for ..., --
  for (const [pattern, replacement] of SPECIAL_RULES) {
    const trimmed = text.trimEnd()
    if (pattern.test(trimmed)) {
      const base = trimmed.replace(pattern, typeof replacement === 'function' ? replacement(trimmed.match(pattern)![0]) : replacement)
      return base + inserted
    }
  }
  return text
}

export function useEditor(
  value: string,
  onChange: (v: string) => void,
  autoConvert = true,
) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget
      const { selectionStart, selectionEnd, value: v } = ta

      // Smart double-quote on “
      if (e.key === '”') {
        e.preventDefault()
        const before = v.slice(0, selectionStart)
        const after = v.slice(selectionEnd)
        if (autoConvert) {
          if (selectionStart !== selectionEnd) {
            const selected = v.slice(selectionStart, selectionEnd)
            const next = before + '“' + selected + '”' + after
            onChange(next)
            openDoubleQuote = false
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = selectionStart + selected.length + 2
            })
            return
          }
          const quote = openDoubleQuote ? '”' : '“'
          openDoubleQuote = !openDoubleQuote
          onChange(before + quote + after)
        } else {
          onChange(before + '”' + after)
        }
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = selectionStart + 1
        })
        return
      }

      // Tab → 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault()
        const before = v.slice(0, selectionStart)
        const after = v.slice(selectionEnd)
        onChange(before + '  ' + after)
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = selectionStart + 2
        })
      }
    },
    [onChange],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const raw = e.target.value
      // Detect last inserted character
      const diff = raw.length - value.length
      const inserted = diff === 1 ? raw[e.target.selectionStart - 1] : ''
      const next = autoConvert ? transformTyping(raw, inserted) : raw
      if (next !== raw) {
        const pos = e.target.selectionStart - (raw.length - next.length)
        onChange(next)
        requestAnimationFrame(() => {
          if (ref.current) {
            ref.current.selectionStart = ref.current.selectionEnd = pos
          }
        })
      } else {
        onChange(raw)
      }
    },
    [value, onChange],
  )

  const insertAt = useCallback(
    (char: string) => {
      const ta = ref.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = value.slice(0, start) + char + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        ta.focus()
        ta.selectionStart = ta.selectionEnd = start + char.length
      })
    },
    [value, onChange],
  )

  return { ref, handleKeyDown, handleChange, insertAt }
}
