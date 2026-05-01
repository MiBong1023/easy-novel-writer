import { useCallback, useRef, useState } from 'react'

export function useFindReplace(
  value: string,
  onChange: (v: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const matchIndexRef = useRef(0)

  const matches = useCallback(() => {
    if (!query) return []
    const results: number[] = []
    let i = value.indexOf(query)
    while (i !== -1) {
      results.push(i)
      i = value.indexOf(query, i + 1)
    }
    return results
  }, [value, query])

  function selectMatch(index: number) {
    const ta = textareaRef.current
    if (!ta || !query) return
    ta.focus()
    ta.setSelectionRange(index, index + query.length)
    // 스크롤을 선택 위치로 맞춤
    const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 24
    const lines = value.slice(0, index).split('\n').length
    ta.scrollTop = (lines - 3) * lineHeight
  }

  function findNext() {
    const list = matches()
    if (!list.length) return
    matchIndexRef.current = (matchIndexRef.current) % list.length
    selectMatch(list[matchIndexRef.current])
    matchIndexRef.current = (matchIndexRef.current + 1) % list.length
  }

  function findPrev() {
    const list = matches()
    if (!list.length) return
    matchIndexRef.current = (matchIndexRef.current - 2 + list.length) % list.length
    selectMatch(list[matchIndexRef.current])
    matchIndexRef.current = (matchIndexRef.current + 1) % list.length
  }

  function replaceCurrent() {
    const ta = textareaRef.current
    if (!ta || !query) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (value.slice(start, end) === query) {
      const next = value.slice(0, start) + replacement + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        ta.setSelectionRange(start, start + replacement.length)
      })
    } else {
      findNext()
    }
  }

  function replaceAll() {
    if (!query) return
    const count = matches().length
    if (!count) return
    onChange(value.split(query).join(replacement))
    matchIndexRef.current = 0
  }

  function handleOpen() {
    matchIndexRef.current = 0
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    textareaRef.current?.focus()
  }

  const matchCount = matches().length

  return {
    open, handleOpen, handleClose,
    query, setQuery,
    replacement, setReplacement,
    matchCount,
    findNext, findPrev,
    replaceCurrent, replaceAll,
  }
}
