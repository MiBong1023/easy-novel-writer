import { useState } from 'react'

export interface SpellError {
  original: string
  correction: string
  help: string
  errorType: string
}

interface ChunkResult {
  original: string
  html: string
  errataCount: number
}

// Naver 맞춤법 검사기 HTML에서 오류 파싱 (DOMParser 사용)
function parseNaverHtml(html: string): SpellError[] {
  if (!html) return []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
    const errors: SpellError[] = []
    const seen = new Set<string>()

    const elements = [
      ...Array.from(doc.querySelectorAll('span[class*="hl_"]')),
      ...Array.from(doc.querySelectorAll('a[class*="hl_"]')),
    ]

    for (const el of elements) {
      const original = el.textContent?.trim() ?? ''
      if (!original) continue

      const correction =
        el.getAttribute('data-correction') ??
        el.getAttribute('data-input') ??
        ''
      if (!correction || correction === original) continue

      const help =
        el.getAttribute('data-err-msg') ??
        el.getAttribute('data-help') ??
        el.getAttribute('title') ??
        ''

      const errorType =
        Array.from(el.classList)
          .find((c) => c.startsWith('hl_'))
          ?.replace('hl_', '') ?? 'spell'

      const key = `${original}→${correction}`
      if (!seen.has(key)) {
        seen.add(key)
        errors.push({ original, correction, help, errorType })
      }
    }
    return errors
  } catch {
    return []
  }
}

export function useSpellCheck() {
  const [checking, setChecking] = useState(false)
  const [errors, setErrors] = useState<SpellError[]>([])
  const [errataCount, setErrataCount] = useState(0)
  const [checked, setChecked] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  async function check(text: string) {
    setChecking(true)
    setApiError(null)
    setErrors([])
    setErrataCount(0)
    setChecked(false)
    try {
      const res = await fetch('/api/spellcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        if (res.status === 404)
          throw new Error('로컬 환경에서는 사용 불가합니다. 배포 후 이용해주세요.')
        throw new Error(`서버 오류 (${res.status})`)
      }
      const data = await res.json() as { chunks?: ChunkResult[]; error?: string }
      if (data.error) throw new Error(data.error)

      const chunks = data.chunks ?? []
      const total = chunks.reduce((s, c) => s + c.errataCount, 0)
      setErrataCount(total)

      const allErrors = chunks.flatMap((c) => parseNaverHtml(c.html))
      setErrors(allErrors)
      setChecked(true)
    } catch (e) {
      setApiError(e instanceof Error ? e.message : String(e))
    } finally {
      setChecking(false)
    }
  }

  function dismissError(index: number) {
    setErrors((prev) => prev.filter((_, i) => i !== index))
  }

  function reset() {
    setErrors([])
    setErrataCount(0)
    setChecked(false)
    setApiError(null)
  }

  return { check, checking, errors, errataCount, checked, apiError, dismissError, reset }
}
