import { useEffect, useRef, useState } from 'react'
import { streamGemini, msg, type GeminiMessage } from '@/lib/gemini'

type Step = 'start' | 'basics' | 'material' | 'draft'

const FORMAT_OPTIONS = ['웹소설', '순문학', '에세이', '일기', '기타'] as const
const PURPOSE_OPTIONS = ['자기 계발', '취미/만족', '부업으로 수익'] as const
const GENRE_OPTIONS = ['로맨스', '판타지', '스릴러', '성장·휴먼', '기타'] as const
const GENRE_ID: Record<string, string> = {
  '로맨스': 'romance', '판타지': 'fantasy', '스릴러': 'thriller',
  '성장·휴먼': 'daily', '기타': 'other',
}
const STRUCTURE_OPTIONS = [
  { label: '한 줄 로그라인', desc: '핵심을 한 문장으로' },
  { label: '5문장 시놉시스', desc: '전체 흐름 요약' },
  { label: '3막 구조',       desc: '도입·전개·결말' },
  { label: '장면 목록',      desc: '씬 카드 나열' },
] as const

interface ChatMsg { role: 'user' | 'ai'; text: string }

export interface WizardResult {
  title: string
  genre: string
  genreId: string
  content: string
}

interface Props {
  onClose: () => void
  onCreate: (result: WizardResult) => void
}

export default function WritingWizard({ onClose, onCreate }: Props) {
  const [step, setStep] = useState<Step>('start')

  // selections
  const [format, setFormat] = useState<string>('웹소설')
  const [genre, setGenre] = useState<string>('')
  const [purpose, setPurpose] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const [structure, setStructure] = useState<string>('3막 구조')

  // material chat
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const geminiHistory = useRef<GeminiMessage[]>([])
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // draft
  const [draft, setDraft] = useState('')
  const [draftStreaming, setDraftStreaming] = useState(false)
  const [draftError, setDraftError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs])

  const materialSystem = `당신은 한국 소설 기획 전문가입니다.
형식: ${format}, 장르: ${genre || format}
작가와 함께 소설 소재를 구체화합니다. 인물, 사건, 배경, 갈등 요소에 대해 한 번에 2~3개의 구체적인 질문을 해주세요. 친근하고 격려하는 어조로 짧게 응답하세요.`

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')
    setChatMsgs((prev) => [...prev, { role: 'user', text }])
    geminiHistory.current = [...geminiHistory.current, msg('user', text)]
    setChatLoading(true)
    setChatMsgs((prev) => [...prev, { role: 'ai', text: '' }])

    try {
      let accumulated = ''
      await streamGemini(
        geminiHistory.current,
        materialSystem,
        (chunk) => {
          accumulated += chunk
          setChatMsgs((prev) => {
            const next = [...prev]
            next[next.length - 1] = { role: 'ai', text: accumulated }
            return next
          })
        },
      )
      geminiHistory.current = [...geminiHistory.current, msg('model', accumulated)]
    } catch (e) {
      setChatMsgs((prev) => {
        const next = [...prev]
        next[next.length - 1] = { role: 'ai', text: `⚠️ ${(e as Error).message}` }
        return next
      })
    } finally {
      setChatLoading(false)
    }
  }

  async function generateDraft() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setDraft('')
    setDraftError('')
    setDraftStreaming(true)

    const materialContext = chatMsgs
      .map((m) => `${m.role === 'user' ? '작가' : 'AI'}: ${m.text}`)
      .join('\n')

    const systemPrompt = `당신은 한국 소설 전문 작가입니다.
형식: ${format}, 장르: ${genre || format}, 구조: ${structure}
${title ? `제목: ${title}` : ''}

아래 소재 논의를 참고해 소설의 첫 장면을 작성하세요.
독자의 흥미를 사로잡는 도입부로 시작하세요. 자연스러운 소설체로 500~800자 내외로 작성하세요.
이야기 텍스트만 출력하세요 (메타 설명 없이).`

    const prompt = materialContext
      ? `소재 논의:\n${materialContext}\n\n위 소재를 바탕으로 첫 장면을 작성해주세요.`
      : `${genre || format} 장르의 흥미로운 첫 장면을 작성해주세요.`

    try {
      let accumulated = ''
      await streamGemini(
        [msg('user', prompt)],
        systemPrompt,
        (chunk) => { accumulated += chunk; setDraft(accumulated) },
        ctrl.signal,
      )
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setDraftError((e as Error).message || '오류가 발생했습니다.')
      }
    } finally {
      setDraftStreaming(false)
    }
  }

  function handleCreate() {
    onCreate({
      title: title.trim() || `${genre || format} 소설`,
      genre,
      genreId: GENRE_ID[genre] ?? 'other',
      content: draft,
    })
  }

  // ── Steps ────────────────────────────────────────────────────────

  if (step === 'start') {
    return (
      <Shell onClose={onClose}>
        <div className="flex flex-col items-center justify-center gap-6 px-6 py-10 text-center">
          <div className="text-5xl">✨</div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">글쓰기를 시작해볼게요!</h2>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Gemini AI가 소재부터 첫 장면까지 함께해요</p>
          </div>
          <p className="text-base font-medium text-gray-700 dark:text-gray-200">글쓰기가 처음이신가요?</p>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={() => setStep('basics')}
              className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
            >
              네, 처음이에요
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-6 py-3 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              아니요, 쓰던 글이 있어요
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600">기존 작업은 에디터의 AI 버튼을 사용하세요</p>
        </div>
      </Shell>
    )
  }

  if (step === 'basics') {
    const canNext = format && purpose && (format !== '웹소설' || genre)
    return (
      <Shell onClose={onClose} progress={1}>
        <div className="flex flex-col overflow-hidden" style={{ height: '100%' }}>
          <div className="shrink-0 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">어떤 글을 쓸까요?</h2>
            <p className="text-sm text-gray-400">글 형식과 목적을 알려주세요</p>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {/* 형식 */}
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">글 형식</p>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((f) => (
                  <Chip key={f} label={f} active={format === f} onClick={() => { setFormat(f); if (f !== '웹소설') setGenre('') }} />
                ))}
              </div>
            </div>
            {/* 장르 (웹소설일 때) */}
            {format === '웹소설' && (
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">장르</p>
                <div className="flex flex-wrap gap-2">
                  {GENRE_OPTIONS.map((g) => (
                    <Chip key={g} label={g} active={genre === g} onClick={() => setGenre(g)} />
                  ))}
                </div>
              </div>
            )}
            {/* 목적 */}
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">쓰는 목적</p>
              <div className="flex flex-wrap gap-2">
                {PURPOSE_OPTIONS.map((p) => (
                  <Chip key={p} label={p} active={purpose === p} onClick={() => setPurpose(p)} />
                ))}
              </div>
            </div>
            {/* 제목 */}
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">작품 제목 (선택)</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="아직 없어도 괜찮아요"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
              />
            </div>
          </div>
          <div className="shrink-0 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
            <button
              onClick={() => setStep('material')}
              disabled={!canNext}
              className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              다음 →
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  if (step === 'material') {
    return (
      <Shell onClose={onClose} progress={2}>
        <div className="flex flex-col overflow-hidden" style={{ height: '100%' }}>
          <div className="shrink-0 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">소재 구체화</h2>
            <p className="text-sm text-gray-400">AI와 이야기 소재를 함께 발전시켜보세요</p>
          </div>
          {/* 대화 영역 */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4">
            {chatMsgs.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-600">
                  어떤 이야기를 쓰고 싶으신가요?<br />간단한 키워드나 아이디어를 입력해보세요.
                </p>
                <p className="mt-2 text-xs text-gray-300 dark:text-gray-700">예: "카페에서 우연히 만난 두 사람의 로맨스"</p>
              </div>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-indigo-600 text-white'
                      : 'rounded-bl-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {m.text || (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
                  )}
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          {/* 입력 + 다음 버튼 */}
          <div className="shrink-0 border-t border-gray-100 p-4 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                disabled={chatLoading}
                placeholder="이야기 아이디어를 입력하세요…"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
              <button
                onClick={sendChat}
                disabled={!chatInput.trim() || chatLoading}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                전송
              </button>
            </div>
            <button
              onClick={() => setStep('draft')}
              className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {chatMsgs.length === 0 ? '건너뛰기 →' : '소재 확정, 다음으로 →'}
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // step === 'draft'
  return (
    <Shell onClose={onClose} progress={3}>
      <div className="flex flex-col overflow-hidden" style={{ height: '100%' }}>
        <div className="shrink-0 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">첫 장면 초안 생성</h2>
          <p className="text-sm text-gray-400">글 구조를 고르고 AI 초안을 만들어보세요</p>
        </div>
        {/* 구조 선택 (초안 없을 때만) */}
        {!draft && (
          <div className="shrink-0 border-b border-gray-100 p-4 dark:border-gray-700">
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">글 구조</p>
            <div className="grid grid-cols-2 gap-2">
              {STRUCTURE_OPTIONS.map(({ label, desc }) => (
                <button
                  key={label}
                  onClick={() => setStructure(label)}
                  className={`rounded-lg border p-3 text-left transition ${
                    structure === label
                      ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950'
                      : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700'
                  }`}
                >
                  <p className={`text-xs font-medium ${structure === label ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}>
                    {label}
                  </p>
                  <p className="text-[10px] text-gray-400">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 초안 영역 */}
        <div className="flex-1 overflow-y-auto p-4">
          {!draft && !draftStreaming && !draftError && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <p className="text-center text-sm text-gray-400 dark:text-gray-600">
                구조를 선택하고 초안을 생성하면<br />첫 장면이 자동으로 작성됩니다
              </p>
              <button
                onClick={generateDraft}
                className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
              >
                ✨ 초안 생성하기
              </button>
            </div>
          )}
          {draftError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {draftError}
              <button onClick={generateDraft} className="mt-2 block underline">다시 시도</button>
            </div>
          )}
          {(draft || draftStreaming) && (
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600">생성된 초안</p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-loose whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {draft}
                {draftStreaming && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-current align-middle" />}
              </div>
            </div>
          )}
        </div>
        {/* 하단 액션 */}
        <div className="shrink-0 border-t border-gray-100 px-4 py-4 dark:border-gray-700">
          {draftStreaming && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
              Gemini가 초안을 작성하는 중…
            </div>
          )}
          {draft && !draftStreaming && (
            <div className="space-y-2">
              <button
                onClick={handleCreate}
                className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
              >
                이 초안으로 에디터 열기 →
              </button>
              <button
                onClick={generateDraft}
                className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                다시 생성하기
              </button>
            </div>
          )}
          {!draft && !draftStreaming && (
            <button
              onClick={() => onCreate({ title: title.trim() || `${genre || format} 소설`, genre, genreId: GENRE_ID[genre] ?? 'other', content: '' })}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              초안 없이 빈 에디터로 시작하기
            </button>
          )}
        </div>
      </div>
    </Shell>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function Shell({ children, onClose, progress }: { children: React.ReactNode; onClose: () => void; progress?: number }) {
  const TOTAL = 3
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        style={{ maxHeight: '90vh', minHeight: 400 }}
      >
        {/* 진행 바 */}
        {progress !== undefined && (
          <div className="absolute left-0 top-0 z-10 h-1 w-full overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${(progress / TOTAL) * 100}%` }}
            />
          </div>
        )}
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          ✕
        </button>
        {/* 컨텐츠 */}
        <div className="flex flex-1 flex-col overflow-hidden" style={{ paddingTop: progress !== undefined ? 4 : 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-indigo-600 text-white'
          : 'border border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950'
      }`}
    >
      {label}
    </button>
  )
}
