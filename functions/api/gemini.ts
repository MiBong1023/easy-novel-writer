interface Env {
  GEMINI_API_KEY: string
}

interface GeminiMessage {
  role: 'user' | 'model'
  parts: [{ text: string }]
}

const MODEL = 'gemini-2.5-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    return json({ error: 'API 키가 설정되지 않았습니다. Cloudflare Pages 환경 변수 GEMINI_API_KEY를 확인하세요.' }, 500)
  }

  let body: { messages: GeminiMessage[]; systemPrompt?: string; stream?: boolean }
  try {
    body = await request.json()
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400)
  }

  if (!body.messages?.length) {
    return json({ error: '메시지가 없습니다.' }, 400)
  }

  const isStream = body.stream === true
  const endpoint = isStream
    ? `${BASE}/${MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`
    : `${BASE}/${MODEL}:generateContent?key=${apiKey}`

  const geminiBody: Record<string, unknown> = {
    contents: body.messages,
    generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
  }
  if (body.systemPrompt) {
    geminiBody.systemInstruction = { parts: [{ text: body.systemPrompt }] }
  }

  // 분당 한도(RPM) 초과 시 최대 2회 재시도 (1s → 2s 간격)
  let resp!: Response
  for (let attempt = 0; attempt <= 2; attempt++) {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    })
    if (resp.status !== 429 || attempt === 2) break
    // 일일 한도 초과는 바로 포기
    const errClone = await resp.clone().json().catch(() => ({})) as { error?: { message?: string } }
    const msg = errClone?.error?.message ?? ''
    if (msg.toLowerCase().includes('day') || msg.toLowerCase().includes('daily')) break
    await new Promise((r) => setTimeout(r, (attempt + 1) * 1200))
  }

  if (!resp.ok) {
    let errMsg = '알 수 없는 오류가 발생했습니다.'
    try {
      const errData = await resp.json() as { error?: { message?: string } }
      errMsg = errData?.error?.message ?? errMsg
    } catch {}
    if (resp.status === 429) {
      const isDaily = errMsg.toLowerCase().includes('day') || errMsg.toLowerCase().includes('daily')
      errMsg = isDaily
        ? '오늘의 AI 도움 횟수를 모두 사용했어요. 내일 오전(한국 시간)에 초기화돼요.'
        : '요청이 잠시 몰렸어요. 몇 초 후 다시 시도해주세요.'
    }
    return json({ error: errMsg }, resp.status)
  }

  if (isStream) {
    return new Response(resp.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  }

  const data = await resp.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const result = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return json({ result })
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
