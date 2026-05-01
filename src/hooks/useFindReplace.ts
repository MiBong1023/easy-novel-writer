import { useCallback, useEffect, useRef, useState } from 'react'

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

  // openRef는 항상 최신 open 값을 가리킴 — 윈도우 리스너 stale closure 방지
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

  // 윈도우 단위 Cmd/Ctrl+F 단 한 번만 등록
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        openRef.current ? handleClose() : handleOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleOpen, handleClose]) // stable refs → 한 번만 등록

  const getMatches = useCallback(() => {
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
    const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 24
    const lines = value.slice(0, index).split('\n').length
    ta.scrollTop = (lines - 3) * lineHeight
  }

  function findNext() {
    const list = getMatches()
    if (!list.length) return
    const idx = matchIndexRef.current % list.length
    selectMatch(list[idx])
    matchIndexRef.current = (idx + 1) % list.length
  }

  function findPrev() {
    const list = getMatches()
    if (!list.length) return
    const idx = (matchIndexRef.current - 2 + list.length) % list.length
    selectMatch(list[idx])
    matchIndexRef.current = (idx + 1) % list.length
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
    onChange(value.split(query).join(replacement))
    matchIndexRef.current = 0
  }

  return {
    open, handleOpen, handleClose,
    query, setQuery,
    replacement, setReplacement,
    matchCount: getMatches().length,
    findNext, findPrev,
    replaceCurrent, replaceAll,
  }
}
