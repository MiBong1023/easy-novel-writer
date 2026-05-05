export type GeminiMessage = {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

export function msg(role: 'user' | 'model', text: string): GeminiMessage {
  return { role, parts: [{ text }] }
}

// ── 일일 사용량 추적 (localStorage, 기기별) ──────────────────────
const DAILY_LIMIT = 250

function todayKey() {
  return `ai-usage-${new Date().toISOString().slice(0, 10)}`
}

export function getAIUsageToday(): number {
  return parseInt(localStorage.getItem(todayKey()) ?? '0', 10)
}

export function incrementAIUsage() {
  const key = todayKey()
  localStorage.setItem(key, String((parseInt(localStorage.getItem(key) ?? '0', 10)) + 1))
}

export function isAILimitReached(): boolean {
  return getAIUsageToday() >= DAILY_LIMIT
}

export function aiUsageWarning(): string | null {
  const used = getAIUsageToday()
  if (used >= DAILY_LIMIT) return `오늘의 AI 사용 횟수(${DAILY_LIMIT}회)를 모두 사용했어요.`
  if (used >= 200) return `오늘 AI를 ${used}회 사용했어요. (하루 ${DAILY_LIMIT}회 한도)`
  return null
}

export async function streamGemini(
  messages: GeminiMessage[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt, stream: true }),
    signal,
  })
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? `API 오류 ${resp.status}`)
  }
  if (!resp.body) throw new Error('응답 스트림 없음')

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let hasContent = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6).trim()
      if (!json || json === '[DONE]') continue
      try {
        const parsed = JSON.parse(json)
        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (text) { onChunk(text); hasContent = true }
      } catch {}
    }
  }
  if (hasContent) incrementAIUsage()
}

export async function callGemini(messages: GeminiMessage[], systemPrompt: string): Promise<string> {
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  })
  const data = await resp.json() as { result?: string; error?: string }
  if (!resp.ok || data.error) throw new Error(data.error ?? `API 오류 ${resp.status}`)
  if (data.result) incrementAIUsage()
  return data.result ?? ''
}
