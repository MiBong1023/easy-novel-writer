interface ChunkResult {
  original: string
  html: string
  errataCount: number
  _raw?: string  // 디버그용: 실제 API 응답 앞부분
}

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
  let rawResponse = ''
  let httpStatus = 0
  try {
    const url = `https://m.search.naver.com/p/csearch/ocontent/spellchecker.nhn?_callback=spellcheck&q=${encodeURIComponent(text)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://m.search.naver.com/',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    httpStatus = res.status
    rawResponse = await res.text()

    if (!rawResponse.trim()) {
      return { original: text, html: '', errataCount: 0, _raw: `[empty response] status=${httpStatus}` }
    }

    const openIdx = rawResponse.indexOf('(')
    if (openIdx === -1) {
      return { original: text, html: '', errataCount: 0, _raw: `[no JSONP] status=${httpStatus} body=${rawResponse.slice(0, 300)}` }
    }

    const json = rawResponse.slice(openIdx + 1).replace(/\);?\s*$/, '').trim()
    if (!json) {
      return { original: text, html: '', errataCount: 0, _raw: `[empty json] status=${httpStatus} raw=${rawResponse.slice(0, 300)}` }
    }

    const data = JSON.parse(json) as { message?: { result?: { html?: string; errata_count?: number } } }
    const result = data?.message?.result ?? {}
    return {
      original: text,
      html: result.html ?? '',
      errataCount: result.errata_count ?? 0,
      _raw: `[ok] status=${httpStatus}`,
    }
  } catch (e) {
    return {
      original: text,
      html: '',
      errataCount: 0,
      _raw: `[error] status=${httpStatus} err=${String(e)} raw=${rawResponse.slice(0, 300)}`,
    }
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
