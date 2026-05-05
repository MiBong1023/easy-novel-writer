export type GeminiMessage = {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

export function msg(role: 'user' | 'model', text: string): GeminiMessage {
  return { role, parts: [{ text }] }
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
        if (text) onChunk(text)
      } catch {}
    }
  }
}

export async function callGemini(messages: GeminiMessage[], systemPrompt: string): Promise<string> {
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, systemPrompt }),
  })
  const data = await resp.json() as { result?: string; error?: string }
  if (!resp.ok || data.error) throw new Error(data.error ?? `API 오류 ${resp.status}`)
  return data.result ?? ''
}
