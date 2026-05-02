interface ChunkResult {
  original: string
  html: string
  errataCount: number
}

// 500자 이하로 문단 경계에서 분할
function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  const paragraphs = text.split(/\n+/)
  let current = ''
  for (const para of paragraphs) {
    const sep = current ? '\n' : ''
    const next = current + sep + para
    if (next.length > maxLen && current) {
      chunks.push(current)
      current = para.slice(0, maxLen)
    } else {
      current = next.length > maxLen ? para.slice(0, maxLen) : next
    }
  }
  if (current) chunks.push(current)
  return chunks.filter(Boolean)
}

async function naverCheck(text: string): Promise<ChunkResult> {
  const url = `https://m.search.naver.com/p/csearch/ocontent/spellchecker.nhn?_callback=spellcheck&q=${encodeURIComponent(text)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://search.naver.com/',
      'Accept': '*/*',
    },
  })
  const jsonp = await res.text()
  // JSONP 래퍼 제거: spellcheck({...})
  const json = jsonp.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '')
  const data = JSON.parse(json)
  const result = (data as { message?: { result?: { html?: string; errata_count?: number } } })?.message?.result ?? {}
  return {
    original: text,
    html: result.html ?? '',
    errataCount: result.errata_count ?? 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function onRequestPost(context: any): Promise<Response> {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const body = await context.request.json() as { text?: string }
    const text = (body.text ?? '').trim()
    if (!text) return new Response(JSON.stringify({ chunks: [] }), { headers })

    const chunks = splitText(text, 500)
    const results: ChunkResult[] = []
    for (const chunk of chunks) {
      results.push(await naverCheck(chunk))
    }
    return new Response(JSON.stringify({ chunks: results }), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers, status: 500 })
  }
}
