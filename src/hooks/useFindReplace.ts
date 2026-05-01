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

  function selectAt(list: number[], idx: number) {
    const ta = textareaRef.current
    if (!ta || !list.length) return
    const pos = list[idx]
    ta.focus()
    ta.setSelectionRange(pos, pos + query.length)
    const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 24
    const lines = value.slice(0, pos).split('\n').length
    ta.scrollTop = (lines - 3) * lineHeight
  }

  function findNext() {
    if (!matches.length) return
    const idx = matchIndexRef.current % matches.length
    selectAt(matches, idx)
    matchIndexRef.current = (idx + 1) % matches.length
  }

  function findPrev() {
    if (!matches.length) return
    const idx = (matchIndexRef.current - 2 + matches.length) % matches.length
    selectAt(matches, idx)
    matchIndexRef.current = (idx + 1) % matches.length
  }

  // 바꾸기 후 새 텍스트 기준으로 다음 매칭 자동 선택
  function replaceCurrent() {
    const ta = textareaRef.current
    if (!ta || !query) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const isMatch = value.slice(start, end) === query

    const newValue = isMatch
      ? value.slice(0, start) + replacement + value.slice(end)
      : value
    if (isMatch) onChange(newValue)

    // 바꾼 위치 이후의 다음 매칭을 새 텍스트에서 계산
    const searchFrom = isMatch ? start + replacement.length : start + query.length
    const nextMatches: number[] = []
    let i = newValue.indexOf(query)
    while (i !== -1) {
      nextMatches.push(i)
      i = newValue.indexOf(query, i + 1)
    }

    if (!nextMatches.length) {
      matchIndexRef.current = 0
      return
    }

    let nextIdx = nextMatches.findIndex((m) => m >= searchFrom)
    if (nextIdx === -1) nextIdx = 0
    matchIndexRef.current = (nextIdx + 1) % nextMatches.length

    requestAnimationFrame(() => {
      const pos = nextMatches[nextIdx]
      ta.focus()
      ta.setSelectionRange(pos, pos + query.length)
    })
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
