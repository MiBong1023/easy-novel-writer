interface ChunkResult {
  original: string
  html: string
  errataCount: number
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

interface DaumError {
  token: string
  correct: string
  errorType: string
}

// Daum HTML에서 <a class="txt_spell_high"> 태그의 data 속성 파싱
function extractDaumErrors(html: string): DaumError[] {
  const errors: DaumError[] = []
  const seen = new Set<string>()

  // <a ... class="...txt_spell_high..." data-error-input="..." data-error-output="..." ...>
  const tagRegex = /<a\s[^>]*class="[^"]*txt_spell_high[^"]*"[\s\S]*?>/g
  let m
  while ((m = tagRegex.exec(html)) !== null) {
    const tag = m[0]
    const inputMatch = /data-error-input="([^"]*)"/.exec(tag)
    const outputMatch = /data-error-output="([^"]*)"/.exec(tag)
    const typeMatch = /data-error-type="([^"]*)"/.exec(tag)

    if (!inputMatch || !outputMatch) continue
    const token = inputMatch[1]
    const correct = outputMatch[1]
    const errorType = typeMatch?.[1] ?? 'spell'
    const key = `${token}→${correct}`
    if (!seen.has(key)) {
      seen.add(key)
      errors.push({ token, correct, errorType })
    }
  }
  return errors
}

const ERROR_TYPE_TO_HL: Record<string, string> = {
  spell: 'yellow',
  space: 'green',
  space_spell: 'yellow',
  punctuation: 'blue',
}

const ERROR_TYPE_LABEL: Record<string, string> = {
  spell: '맞춤법',
  space: '띄어쓰기',
  space_spell: '맞춤법+띄어쓰기',
  punctuation: '문장부호',
}

// 오류 목록 → 클라이언트 파서가 읽을 hl_ 마크업으로 변환
function buildMarkedHtml(originalText: string, errors: DaumError[]): string {
  let result = originalText
  for (const { token, correct, errorType } of errors) {
    const hl = ERROR_TYPE_TO_HL[errorType] ?? 'yellow'
    const label = ERROR_TYPE_LABEL[errorType] ?? '오류'
    result = result.replace(
      token,
      `<span class="hl_${hl}" data-correction="${correct}" data-err-msg="${label}">${token}</span>`,
    )
  }
  return result
}

async function daumCheck(text: string): Promise<ChunkResult> {
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
      },
      body: `sentence=${encodeURIComponent(text)}`,
    })

    if (res.status !== 200) {
      return { original: text, html: '', errataCount: 0 }
    }

    const html = await res.text()
    const errors = extractDaumErrors(html)

    if (!errors.length) {
      return { original: text, html: '', errataCount: 0 }
    }

    return {
      original: text,
      html: buildMarkedHtml(text, errors),
      errataCount: errors.length,
    }
  } catch {
    return { original: text, html: '', errataCount: 0 }
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
      results.push(await daumCheck(chunk))
    }
    return new Response(JSON.stringify({ chunks: results }), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { headers, status: 500 })
  }
}
