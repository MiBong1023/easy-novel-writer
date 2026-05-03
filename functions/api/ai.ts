interface Env {
  ANTHROPIC_API_KEY: string
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { text, type } = await context.request.json<{ text: string; type: 'continue' | 'refine' }>()
  const apiKey = context.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })
  }
  if (!text?.trim()) {
    return new Response(JSON.stringify({ error: 'No text provided' }), { status: 400 })
  }

  const system =
    type === 'refine'
      ? '당신은 한국어 소설 편집자입니다. 주어진 문장을 원래 의미와 분량을 유지하면서 더 문학적이고 자연스럽게 다듬어 주세요. 수정된 문장만 출력하세요.'
      : '당신은 한국어 소설 작가입니다. 주어진 소설 내용에 이어서 자연스럽게 다음 내용을 작성해 주세요. 앞 내용의 문체와 분위기를 유지하고 200자 내외로 작성하세요. 이어지는 내용만 출력하세요.'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system,
      messages: [{ role: 'user', content: text }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return new Response(JSON.stringify({ error: err }), { status: res.status })
  }

  const data = await res.json<{ content: { text: string }[] }>()
  const result = data.content?.[0]?.text ?? ''
  return new Response(JSON.stringify({ result }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
