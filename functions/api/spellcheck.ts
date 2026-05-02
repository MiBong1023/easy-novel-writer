interface ChunkResult {
  original: string
  html: string
  errataCount: number
  _raw?: string
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

async function daumCheck(text: string): Promise<ChunkResult> {
  let rawResponse = ''
  let httpStatus = 0
  try {
    const res = await fetch('https://dic.daum.net/grammar_checker.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://dic.daum.net/grammar_checker.do',
        'Accept': 'application/json, text/html, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Origin': 'https://dic.daum.net',
      },
      body: `sentence=${encodeURIComponent(text)}`,
    })
    httpStatus = res.status
    rawResponse = await res.text()

    if (httpStatus !== 200) {
      return { original: text, html: '', errataCount: 0, _raw: `[status=${httpStatus}] ${rawResponse.slice(0, 300)}` }
    }

    // Daum 응답 파싱 시도 1: 직접 JSON
    try {
      const json = JSON.parse(rawResponse) as { result?: string; data?: { errors?: unknown[] } }
      if (json.result === 'DONE') {
        const errors = json.data?.errors ?? []
        return parseDaumErrors(text, errors as DaumError[], rawResponse, httpStatus)
      }
    } catch { /* not plain JSON */ }

    // Daum 응답 파싱 시도 2: HTML 내 JSON 추출
    const jsonMatch = rawResponse.match(/[\[{][\s\S]*[}\]]\s*$/) ??
                      rawResponse.match(/var\s+\w+\s*=\s*({[\s\S]+?});/) ??
                      rawResponse.match(/\(({[\s\S]+?})\)/)

    if (jsonMatch) {
      try {
        const json = JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as { result?: string; data?: { errors?: unknown[] } }
        const errors = json.data?.errors ?? []
        return parseDaumErrors(text, errors as DaumError[], rawResponse, httpStatus)
      } catch { /* parse failed */ }
    }

    return {
      original: text,
      html: rawResponse,   // 클라이언트 DOMParser용으로 HTML 전달
      errataCount: -1,     // -1 = HTML 모드
      _raw: `[html mode] status=${httpStatus} len=${rawResponse.length} preview=${rawResponse.slice(0, 200)}`,
    }
  } catch (e) {
    return { original: text, html: '', errataCount: 0, _raw: `[exception] status=${httpStatus} ${String(e)} raw=${rawResponse.slice(0, 200)}` }
  }
}

interface DaumError {
  token?: string
  str?: string
  help?: string
  new_str?: string
  candidates?: string[] | string
}

function parseDaumErrors(text: string, errors: DaumError[], raw: string, status: number): ChunkResult {
  // Daum 오류 배열 → Naver 호환 HTML 마크업으로 변환
  if (!errors.length) {
    return { original: text, html: '', errataCount: 0, _raw: `[ok no errors] status=${status}` }
  }
  let html = text
  for (const e of errors) {
    const wrong = e.token ?? e.str ?? ''
    const correct = Array.isArray(e.candidates) ? e.candidates[0] : (e.new_str ?? '')
    const help = e.help ?? ''
    if (wrong && correct && wrong !== correct) {
      html = html.replace(
        wrong,
        `<span class="hl_yellow" data-correction="${correct}" data-err-msg="${help}">${wrong}</span>`,
      )
    }
  }
  return { original: text, html, errataCount: errors.length, _raw: `[ok] status=${status} errors=${errors.length}` }
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
      results.push(await daumCheck(chunk))
    }
    return new Response(JSON.stringify({ chunks: results }), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers, status: 500 })
  }
}
