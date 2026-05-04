import { useEffect, useState } from 'react'

export function useTimer() {
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setTotalSeconds((s) => {
        if (s <= 1) {
          setRunning(false)
          setDone(true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  // 완료 후 3초 뒤 자동 초기화
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 3000)
    return () => clearTimeout(t)
  }, [done])

  function start(minutes: number) {
    setTotalSeconds(minutes * 60)
    setRunning(true)
    setDone(false)
  }

  function stop() {
    setRunning(false)
    setTotalSeconds(0)
    setDone(false)
  }

  return {
    running,
    done,
    start,
    stop,
    mins: Math.floor(totalSeconds / 60),
    secs: totalSeconds % 60,
  }
}
