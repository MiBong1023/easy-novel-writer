import { useState } from 'react'
import { getItem, setItem } from '@/store/localStorage'

const DEFAULT_GOAL = 6000

export function useGoal(episodeId: string) {
  const [goal, setGoalState] = useState<number>(
    () => getItem<number>(`goal:${episodeId}`) ?? DEFAULT_GOAL,
  )

  function setGoal(value: number) {
    const clamped = Math.max(100, Math.min(100_000, value))
    setGoalState(clamped)
    setItem(`goal:${episodeId}`, clamped)
  }

  return { goal, setGoal }
}
