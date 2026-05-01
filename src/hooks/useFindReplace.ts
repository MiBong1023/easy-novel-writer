import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export function useFindReplace(
  value: string,
  onChange: (v: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  const [open, setOpenState] = useState(false)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const matchIndexRef = useRef(0)
  const openRef = useRef(false)

  function setOpen(v: boolean) {
    openRef.current = v
    setOpenState(v)
  }

  const handleOpen = useCallback(() => {
    matchIndexRef.current = 0
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    textareaRef.current?.focus()
  }, [textareaRef])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        openRef.current ? handleClose() : handleOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleOpen, handleClose])

  // useMemo로 매 렌더마다 최신 value/query 기준으로 계산
  const matches = useMemo(() => {
    if (!query) return [] as number[]
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
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(index, index + query.length)
    const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 24
    const lines = value.slice(0, index).split('\n').length
    ta.scrollTop = (lines - 3) * lineHeight
  }

  function findNext() {
    if (!matches.length) return
    const idx = matchIndexRef.current % matches.length
    selectMatch(matches[idx])
    matchIndexRef.current = (idx + 1) % matches.length
  }

  function findPrev() {
    if (!matches.length) return
    const idx = (matchIndexRef.current - 2 + matches.length) % matches.length
    selectMatch(matches[idx])
    matchIndexRef.current = (idx + 1) % matches.length
  }

  function replaceCurrent() {
    const ta = textareaRef.current
    if (!ta || !query) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    if (value.slice(start, end) === query) {
      onChange(value.slice(0, start) + replacement + value.slice(end))
      requestAnimationFrame(() => {
        ta.setSelectionRange(start, start + replacement.length)
      })
    } else {
      findNext()
    }
  }

  function replaceAll() {
    if (!query || !matches.length) return
    onChange(value.split(query).join(replacement))
    matchIndexRef.current = 0
  }

  return {
    open, handleOpen, handleClose,
    query, setQuery,
    replacement, setReplacement,
    matchCount: matches.length,
    findNext, findPrev,
    replaceCurrent, replaceAll,
  }
}
