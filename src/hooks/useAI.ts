import { useState } from 'react'

type AIType = 'continue' | 'refine'
type AIStatus = 'idle' | 'loading' | 'done' | 'error'

export function useAI() {
  const [status, setStatus] = useState<AIStatus>('idle')
  const [result, setResult] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function run(text: string, type: AIType) {
    setStatus('loading')
    setResult('')
    setErrorMsg('')
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, type }),
      })
      const data = await res.json() as { result?: string; error?: string }
      if (!res.ok || data.error) {
        setErrorMsg(data.error ?? '오류가 발생했습니다.')
        setStatus('error')
      } else {
        setResult(data.result ?? '')
        setStatus('done')
      }
    } catch {
      setErrorMsg('네트워크 오류가 발생했습니다.')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setResult('')
    setErrorMsg('')
  }

  return { status, result, errorMsg, run, reset }
}
