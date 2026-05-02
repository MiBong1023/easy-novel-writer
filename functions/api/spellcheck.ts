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

// Daum HTML에서 오류 데이터 추출 시도
function parseDaumHtmlBody(html: string, originalText: string): ChunkResult {
  const debug: string[] = []

  // 1) script 태그에서 JSON 오류 배열 탐색
  const scriptBlocks = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  for (const m of scriptBlocks) {
    const s = m[1]
    // errors / errInfo / wrongList 같은 키 탐색
    const patterns = [
      /(?:errors|errInfo|wrongList|result)\s*[:=]\s*(\[[\s\S]{0,3000}?\])\s*[;,}]/,
      /"token"\s*:\s*"([^"]+)"/g,
    ]
    for (const p of patterns) {
      const found = s.match(p)
      if (found) {
        debug.push(`SCRIPT_JSON(${found[0].slice(0, 400)})`)
        break
      }
    }
  }

  // 2) 모든 클래스명 수집 (구조 파악)
  const classes = new Set<string>()
  for (const m of html.matchAll(/class="([^"]+)"/g)) {
    m[1].split(/\s+/).forEach((c) => classes.add(c))
  }
  debug.push(`CLASSES: ${[...classes].join(' ')}`)

  // 3) data-* 속성이 있는 span/a 추출 (교정 정보가 data 속성에 있을 수 있음)
  const dataElems = [...html.matchAll(/<(?:span|a)\s[^>]*data-[^>]+>/gi)]
  if (dataElems.length > 0) {
    debug.push(`DATA_ELEMS: ${dataElems.slice(0, 5).map((m) => m[0]).join('\n')}`)
  }

  // 4) <body> 시작 후 2000자 추출 (결과 영역)
  const bodyIdx = html.indexOf('<body')
  const bodyExcerpt = bodyIdx !== -1 ? html.slice(bodyIdx, bodyIdx + 2000) : html.slice(0, 2000)
  debug.push(`BODY_START: ${bodyExcerpt}`)

  return {
    original: originalText,
    html: '',
    errataCount: 0,
    _raw: debug.join('\n====\n').slice(0, 4000),
  }
}

async function daumCheck(text: string): Promise<ChunkResult> {
  let rawHtml = ''
  let httpStatus = 0
  try {
    const res = await fetch('https://dic.daum.net/grammar_checker.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://dic.daum.net/grammar_checker.do',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Origin': 'https://dic.daum.net',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: `sentence=${encodeURIComponent(text)}`,
    })
    httpStatus = res.status
    rawHtml = await res.text()

    if (httpStatus !== 200) {
      return { original: text, html: '', errataCount: 0, _raw: `[status=${httpStatus}] ${rawHtml.slice(0, 300)}` }
    }

    // JSON 응답인 경우
    const trimmed = rawHtml.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const data = JSON.parse(trimmed) as { result?: string; errors?: DaumError[]; data?: { errors?: DaumError[] } }
      const errors = data.errors ?? data.data?.errors ?? []
      return buildFromDaumErrors(text, errors, httpStatus)
    }

    // HTML 응답 → 구조 분석 후 반환
    return parseDaumHtmlBody(rawHtml, text)
  } catch (e) {
    return { original: text, html: '', errataCount: 0, _raw: `[exception] status=${httpStatus} ${String(e)}` }
  }
}

interface DaumError {
  token?: string
  str?: string
  help?: string
  new_str?: string
  candidates?: string | string[]
  orgStr?: string
  candWord?: string
  errMsg?: string
}

function buildFromDaumErrors(text: string, errors: DaumError[], status: number): ChunkResult {
  if (!errors.length) return { original: text, html: '', errataCount: 0, _raw: `[ok, no errors] status=${status}` }
  let html = text
  for (const e of errors) {
    const wrong = e.token ?? e.str ?? e.orgStr ?? ''
    const raw = e.candidates ?? e.new_str ?? e.candWord ?? ''
    const correct = Array.isArray(raw) ? raw[0] : raw.split('|')[0]
    const help = e.help ?? e.errMsg ?? ''
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
