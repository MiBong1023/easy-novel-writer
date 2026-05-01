import { useMemo } from 'react'

export function useWordCount(text: string, goal: number = 6000) {
  return useMemo(() => {
    const count = text.length
    const percent = Math.min(Math.round((count / goal) * 100), 100)
    return { count, percent }
  }, [text, goal])
}
