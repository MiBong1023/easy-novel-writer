import { useRef, useState } from 'react'
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { streamGemini, msg, type GeminiMessage, aiUsageWarning, isAILimitReached, getAIUsageToday } from '@/lib/gemini'

type HelpType = 'continue' | 'refine' | 'expand' | 'shorten' | 'tone' | 'spellfix' | 'custom'

interface Props {
  value: string
  selectedText: string
  onInsert: (text: string) => void
  onClose: () => void
  novelId?: string
  uid?: string
  episodeOrder?: number
}

const HELP_BUTTONS: { id: HelpType; label: string }[] = [
  { id: 'continue',  label: '이어쓰기' },
  { id: 'refine',    label: '문장 다듬기' },
  { id: 'expand',    label: '더 구체적으로' },
  { id: 'shorten',   label: '길이 줄이기' },
  { id: 'tone',      label: '어조 변경' },
  { id: 'spellfix',  label: '맞춤법 교정' },
]

const SYSTEM: Record<HelpType, string> = {
  continue: '당신은 한국어 소설 작가입니다. 주어진 소설 내용에 자연스럽게 이어지는 다음 내용을 200자 내외로 작성하세요. 앞 내용의 문체와 분위기를 유지하고, 이어지는 내용만 출력하세요.',
  refine:   '당신은 한국어 소설 편집자입니다. 주어진 문장을 원래 의미와 분량을 유지하면서 더 문학적이고 자연스럽게 다듬어 주세요. 수정된 문장만 출력하세요.',
  expand:   '당신은 한국어 소설 편집자입니다. 주어진 내용을 더 구체적이고 생동감 있게 확장해 주세요. 원래 길이의 1.5~2배로 늘리세요. 확장된 텍스트만 출력하세요.',
  shorten:  '당신은 한국어 소설 편집자입니다. 주어진 내용을 핵심을 유지하면서 절반 정도로 압축해 주세요. 압축된 텍스트만 출력하세요.',
  tone:     '당신은 한국어 소설 편집자입니다. 주어진 문장을 더 감성적이고 문학적인 어조로 바꿔 주세요. 바뀐 텍스트만 출력하세요.',
  spellfix: '당신은 한국어 교정 전문가입니다. 주어진 텍스트의 맞춤법과 문법 오류를 교정해 주세요. 교정된 텍스트만 출력하세요.',
  custom:   '당신은 한국어 소설 전문 편집자입니다. 요청된 작업을 수행하고 결과 텍스트만 출력하세요.',
}

export default function AIPanel({ value, selectedText, onInsert, onClose, novelId, uid, episodeOrder }: Props) {
  const usageWarning = aiUsageWarning()
  const limitReached = isAILimitReached()
  const usedToday = getAIUsageToday()

  const [activeType, setActiveType] = useState<HelpType | null>(null)
  const [customInput, setCustomInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<GeminiMessage[]>([])
  const [hasContext, setHasContext] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function run(type: HelpType, userOverride?: string) {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setActiveType(type)
    setResult('')
    setError('')
    setStreaming(true)

    let userText: string
    if (type === 'continue') {
      const currentChunk = value.slice(-600) || '소설을 시작해주세요.'

      // 이전 회차 요약 컨텍스트 조회
      let contextPrefix = ''
      if (novelId && uid && episodeOrder && episodeOrder > 1) {
        try {
          const epRef = collection(db, 'users', uid, 'novels', novelId, 'episodes')
          const snap = await getDocs(
            query(epRef, where('order', '<', episodeOrder), orderBy('order', 'desc'), limit(3))
          )
          const prevEps = snap.docs
            .map((d) => ({ order: d.data().order as number, summary: d.data().summary as string | undefined, excerpt: d.data().excerpt as string | undefined }))
            .filter((ep) => ep.summary || ep.excerpt)
            .reverse()
          if (prevEps.length > 0) {
            contextPrefix = '【이전 회차 요약】\n' +
              prevEps.map((ep) => `${ep.order}화: ${ep.summary ?? ep.excerpt ?? ''}`).join('\n') +
              '\n\n【현재 회차 내용 (이어쓰기 대상)】\n'
            setHasContext(true)
          }
        } catch { /* 맥락 없이 진행 */ }
      }

      userText = contextPrefix + currentChunk
    } else if (type === 'custom') {
      userText = userOverride ?? customInput.trim()
      if (!userText) { setStreaming(false); return }
    } else {
      const source = selectedText || value.slice(-400)
      if (!source) {
        setError('텍스트를 선택하거나 내용을 먼저 입력해주세요.')
        setStreaming(false)
        return
      }
      userText = source
    }

    const newMsg = msg('user', userText)
    const messages = [...history, newMsg]

    try {
      let accumulated = ''
      await streamGemini(
        messages,
        SYSTEM[type],
        (chunk) => { accumulated += chunk; setResult(accumulated) },
        ctrl.signal,
      )
      setHistory([...messages, msg('model', accumulated)])
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message || '오류가 발생했습니다.')
      }
    } finally {
      setStreaming(false)
    }
  }

  function reset() {
    abortRef.current?.abort()
    setActiveType(null)
    setResult('')
    setError('')
    setHistory([])
    setCustomInput('')
    setStreaming(false)
    setHasContext(false)
  }

  return (
    <>
      {/* 모바일 배경 딤 */}
      <div
        className="fixed inset-0 z-40 bg-gray-900/40 sm:hidden"
        onClick={onClose}
      />
      <div className="
        fixed inset-x-0 bottom-0 z-50 flex h-[72dvh] flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl
        sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:h-full sm:w-80 sm:rounded-none sm:border-l sm:border-t-0 sm:shadow-xl
        dark:border-gray-700 dark:bg-gray-900
      ">
      {/* 모바일 드래그 핸들 */}
      <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
        <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
      </div>
      {/* 헤더 */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">AI 글쓰기 보조</span>
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/60 dark:text-blue-400">
            Gemini
          </span>
          {hasContext && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400">
              맥락 포함
            </span>
          )}
          {usedToday >= 200 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${limitReached ? 'bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400'}`}>
              {usedToday}/250
            </span>
          )}
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">✕</button>
      </div>

      {/* 사용량 경고 */}
      {usageWarning && (
        <div className={`shrink-0 px-4 py-2 text-[11px] ${limitReached ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'}`}>
          {usageWarning}
        </div>
      )}

      {/* 도움 유형 버튼 */}
      <div className="shrink-0 border-b border-gray-100 p-3 dark:border-gray-700">
        <div className="grid grid-cols-3 gap-1.5">
          {HELP_BUTTONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => run(id)}
              disabled={streaming || limitReached}
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                activeType === id
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {selectedText && (
          <p className="mt-2 line-clamp-1 text-[10px] text-indigo-400 dark:text-indigo-500">
            선택: {selectedText.slice(0, 40)}{selectedText.length > 40 ? '…' : ''}
          </p>
        )}
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {!activeType && !error && (
          <p className="mt-8 text-center text-sm text-gray-400 dark:text-gray-600">
            도움 유형을 선택하거나<br />아래에 직접 요청하세요
          </p>
        )}
        {streaming && !result && (
          <div className="flex flex-col items-center justify-center gap-3 mt-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
            <p className="text-xs text-gray-400">Gemini 작성 중…</p>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {result && (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600">제안</p>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {result}
              {streaming && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-current align-middle" />}
            </div>
          </div>
        )}
      </div>

      {/* 직접 입력 */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
        <form
          onSubmit={(e) => { e.preventDefault(); if (customInput.trim()) run('custom') }}
          className="flex gap-1.5"
        >
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={limitReached ? '오늘 한도 초과' : '직접 요청… (Enter)'}
            disabled={streaming || limitReached}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
          />
          <button
            type="submit"
            disabled={!customInput.trim() || streaming || limitReached}
            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            ↵
          </button>
        </form>
      </div>

      {/* 삽입 버튼 */}
      {result && !streaming && (
        <div className="shrink-0 flex gap-2 border-t border-gray-100 px-3 py-3 dark:border-gray-700">
          <button
            onClick={() => { onInsert(result); reset() }}
            className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            삽입
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            초기화
          </button>
        </div>
      )}
    </div>
    </>
  )
}
