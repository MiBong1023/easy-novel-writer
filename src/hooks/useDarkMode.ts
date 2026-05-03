import { useEffect, useState } from 'react'

const KEY = 'dark-mode'

function getInitial(): boolean {
  const stored = localStorage.getItem(KEY)
  if (stored !== null) return stored === 'true'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useDarkMode() {
  const [dark, setDark] = useState(getInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(KEY, String(dark))
  }, [dark])

  // 사용자가 수동으로 설정하지 않은 경우 시스템 변경에 따라 자동 업데이트
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(KEY) === null) setDark(e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function toggle() {
    setDark((v) => {
      localStorage.setItem(KEY, String(!v))
      return !v
    })
  }

  return { dark, toggle }
}
