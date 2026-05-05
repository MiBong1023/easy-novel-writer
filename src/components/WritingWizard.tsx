import { useEffect, useRef, useState } from 'react'
import { streamGemini, msg, type GeminiMessage } from '@/lib/gemini'
import type { NovelGenre } from '@/types'

// ── Types ─────────────────────────────────────────────────────────

type Step =
  | 'purpose'
  | 'purpose_ai_explain'
  | 'format'
  | 'genre'
  | 'genre_first_time'
  | 'genre_ai_explain'
  | 'has_draft'
  | 'help_offer'
  | 'backbone'
  | 'draft'
  | 'existing_paste'
  | 'existing_help'
  | 'existing_result'

// ── Constants ─────────────────────────────────────────────────────

const MALE_GENRES = [
  { id: '판타지 / 퓨전',      desc: '이세계 진출, 드래곤, 마법 등' },
  { id: '현대 판타지 (현판)',  desc: '헌터물, 재벌물, 전문가물 (의사, 변호사 등)' },
  { id: '무협',              desc: '천마, 무림, 문파 간의 갈등을 다룬 무협 웹소설' },
  { id: '게임 판타지',        desc: '게임 속 세상에 들어가거나 게임 능력치를 가진 주인공의 성장기' },
]

const FEMALE_GENRES = [
  { id: '로맨스 판타지 (로판)', desc: '판타지 세계관의 로맨스. 공작, 황제, 계약 결혼 등' },
  { id: '현대 로맨스',         desc: '현대 배경의 남녀 간 사랑 이야기' },
  { id: 'BL',                desc: '남성 간의 로맨스를 다루는 장르' },
]

const BACKBONE_QUESTIONS = [
  {
    q: '이 작품의 장르와 소재가 주는 기대감이 무엇인가요?',
    hint: '독자가 "오, 이거 재밌겠다!"라고 느끼는 포인트는 무엇인가요?',
    example: '예: "헌터 세계관에서 혼자만 약한 주인공이 비밀 능력을 각성하는 반전"',
    badge: '독자 훅 설정',
  },
  {
    q: '주인공의 목표와 매력은 어떤 것인가요?',
    hint: '독자가 주인공을 응원하게 만드는 이유는 무엇인가요?',
    example: '예: "외면당해온 설움을 딛고 최강이 되고자 하는 집념, 의리있는 성격"',
    badge: '캐릭터 설계',
  },
  {
    q: '주인공의 성장 요소는 무엇이고, 그것이 특별하게 느껴지는 이유는 무엇인가요?',
    hint: '레벨업? 무공 수련? 인맥? 이 작품만의 성장 방식이 왜 특별한가요?',
    example: '예: "죽을수록 강해지는 능력 — 실패가 곧 성장이 되는 역설"',
    badge: '서사 동력 설정',
  },
  {
    q: '작품의 주제를 한 줄로 써주세요.',
    hint: '이 이야기를 통해 독자에게 전달하고 싶은 핵심 메시지',
    example: '예: "1차 세계대전 시대에 환생한 주인공이 미래 지식을 활용하여 미래를 바꿔서 승승장구하는 이야기"',
    badge: '핵심 메시지',
  },
]

const EXISTING_HELP_OPTIONS = [
  { id: '구조 재정리',   desc: '전체 흐름과 단락 구조를 다듬어드려요' },
  { id: '논리/흐름 강화', desc: '내용의 논리성과 전개 흐름을 강화해요' },
  { id: '표현/문체 개선', desc: '문장의 표현력과 문학적 완성도를 높여요' },
  { id: '요약 또는 확장', desc: '더 짧게 요약하거나 풍부하게 확장해요' },
  { id: '제목/소제목 제안', desc: '어울리는 제목과 소제목을 제안해드려요' },
]

const PURPOSE_AI_EXPLAIN = `웹소설: 독자를 사로잡는 빠른 전개와 강한 주인공이 특징. 판타지, 로맨스 등 장르를 선택해 연재하며, 인기 작가들은 수익도 낼 수 있어요.

순문학 / 추리 / 동화 / 시나리오: 문학적 완성도와 깊이를 추구해요. 자신만의 문체와 세계관으로 독창적인 이야기를 만들고 싶을 때 선택해요.

일기 / 에세이: 내 일상과 생각을 글로 기록해요. 글쓰기 부담이 가장 적고, 내면 정리와 자기 계발에 효과적이에요.`

function getGenreId(genreDetail: string, format: string): NovelGenre {
  if (['판타지 / 퓨전', '현대 판타지 (현판)', '게임 판타지'].includes(genreDetail)) return 'fantasy'
  if (genreDetail === '무협') return 'martial'
  if (['로맨스 판타지 (로판)', '현대 로맨스', 'BL'].includes(genreDetail)) return 'romance'
  if (format === '일기 / 에세이') return 'daily'
  return 'daily'
}

const PROGRESS_MAP: Partial<Record<Step, number>> = {
  purpose: 0, purpose_ai_explain: 0,
  format: 1, genre: 1, genre_first_time: 1, genre_ai_explain: 1,
  has_draft: 2, help_offer: 2,
  backbone: 3,
  draft: 4,
  existing_paste: 2, existing_help: 3, existing_result: 4,
}
const TOTAL = 5

// ── Exported Types ─────────────────────────────────────────────────

export interface WizardResult {
  title: string
  genre: string
  genreId: NovelGenre
  content: string
}

interface Props {
  onClose: () => void
  onCreate: (result: WizardResult) => void
}

// ── Main Component ─────────────────────────────────────────────────

export default function WritingWizard({ onClose, onCreate }: Props) {
  const [stepStack, setStepStack] = useState<Step[]>(['purpose'])
  const step = stepStack[stepStack.length - 1]
  const progress = PROGRESS_MAP[step] ?? 0

  function goTo(next: Step) { setStepStack(p => [...p, next]) }
  function goBack() {
    if (stepStack.length > 1) setStepStack(p => p.slice(0, -1))
    else onClose()
  }

  // Context
  const [format, setFormat] = useState('')
  const [, setGenderPath] = useState('')
  const [genreDetail, setGenreDetail] = useState('')
  const [title, setTitle] = useState('')

  // Backbone
  const [backbone, setBackbone] = useState(['', '', '', ''])
  const [boneIdx, setBoneIdx] = useState(0)
  const [boneInput, setBoneInput] = useState('')

  // Existing user
  const [existingDraft, setExistingDraft] = useState('')
  const [selectedHelp, setSelectedHelp] = useState('')

  // AI explain (purpose / genre)
  const [aiExplain, setAiExplain] = useState(PURPOSE_AI_EXPLAIN)
  const [aiExplainStreaming, setAiExplainStreaming] = useState(false)

  // Draft + refinement
  const [draft, setDraft] = useState('')
  const [draftStreaming, setDraftStreaming] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [refineInput, setRefineInput] = useState('')
  const [refineStreaming, setRefineStreaming] = useState(false)
  const refineHistRef = useRef<GeminiMessage[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // 'draft' 단계 진입 시 자동 생성
  const prevStep = useRef<Step | null>(null)
  useEffect(() => {
    if (step === 'draft' && prevStep.current !== 'draft' && !draft && !draftStreaming) {
      generateDraft()
    }
    prevStep.current = step
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // 'existing_result' 단계 진입 시 자동 실행
  const prevStepEx = useRef<Step | null>(null)
  useEffect(() => {
    if (step === 'existing_result' && prevStepEx.current !== 'existing_result' && !draft && !draftStreaming) {
      runExistingHelp()
    }
    prevStepEx.current = step
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI helpers ────────────────────────────────────────────────────

  async function explainGenres() {
    setAiExplain('')
    setAiExplainStreaming(true)
    const prompt = `웹소설을 처음 시작하는 분에게 다음 장르들을 각각 한 줄로 짧고 친근하게 설명해주세요:

남성향
- 판타지/퓨전: ?
- 현대 판타지(현판): ?
- 무협: ?
- 게임 판타지: ?

여성향
- 로맨스 판타지(로판): ?
- 현대 로맨스: ?
- BL: ?`
    try {
      let acc = ''
      await streamGemini(
        [msg('user', prompt)],
        '당신은 웹소설 장르 안내 전문가입니다. 각 장르의 매력을 짧고 쉽게 설명해주세요.',
        (chunk) => { acc += chunk; setAiExplain(acc) },
      )
    } finally {
      setAiExplainStreaming(false)
    }
  }

  async function generateDraft() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setDraft(''); setDraftError(''); setDraftStreaming(true)
    refineHistRef.current = []

    const ctx = genreDetail || format || '소설'
    const systemPrompt = `당신은 한국 소설 전문 작가입니다. ${ctx} 장르의 소설 첫 장면을 작성합니다.
독자의 흥미를 사로잡는 도입부로 시작하세요. 자연스러운 소설체로 600~1000자 내외로 작성하세요.
이야기 텍스트만 출력하세요 (메타 설명 없이).`

    const boneCtx = backbone
      .map((ans, i) => ans.trim() ? `${BACKBONE_QUESTIONS[i].badge}: ${ans}` : '')
      .filter(Boolean).join('\n')
    const prompt = boneCtx
      ? `다음 작품 뼈대를 바탕으로 첫 장면을 작성해주세요:\n${boneCtx}${title ? `\n제목: ${title}` : ''}`
      : `${ctx} 장르의 흥미로운 첫 장면을 작성해주세요.`

    const userMsg = msg('user', prompt)
    refineHistRef.current = [userMsg]
    try {
      let acc = ''
      await streamGemini([userMsg], systemPrompt, (chunk) => { acc += chunk; setDraft(acc) }, ctrl.signal)
      refineHistRef.current = [...refineHistRef.current, msg('model', acc)]
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setDraftError((e as Error).message || '오류가 발생했습니다.')
    } finally {
      setDraftStreaming(false)
    }
  }

  async function refineDraft() {
    const input = refineInput.trim()
    if (!input || refineStreaming || draftStreaming) return
    setRefineInput(''); setRefineStreaming(true)
    const userMsg = msg('user', input)
    const messages = [...refineHistRef.current, userMsg]
    refineHistRef.current = messages
    try {
      let acc = ''
      await streamGemini(
        messages,
        '당신은 한국 소설 전문 편집자입니다. 유저의 요청에 따라 텍스트를 수정하고 결과 텍스트만 출력하세요.',
        (chunk) => { acc += chunk; setDraft(acc) },
      )
      refineHistRef.current = [...refineHistRef.current, msg('model', acc)]
    } finally {
      setRefineStreaming(false)
    }
  }

  async function runExistingHelp() {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setDraft(''); setDraftStreaming(true)
    refineHistRef.current = []

    const userMsg = msg('user', `다음 텍스트에 대해 "${selectedHelp}"를 해주세요:\n\n${existingDraft}`)
    refineHistRef.current = [userMsg]
    try {
      let acc = ''
      await streamGemini(
        [userMsg],
        '당신은 한국 소설 전문 편집자입니다. 요청된 작업을 수행하고 결과 텍스트만 출력하세요. 수정 이유도 마지막에 간단히 설명해주세요.',
        (chunk) => { acc += chunk; setDraft(acc) },
        ctrl.signal,
      )
      refineHistRef.current = [...refineHistRef.current, msg('model', acc)]
    } finally {
      setDraftStreaming(false)
    }
  }

  function handleCreate(content?: string) {
    onCreate({
      title: title.trim() || `${genreDetail || format || '소설'} 소설`,
      genre: genreDetail || format || '',
      genreId: getGenreId(genreDetail, format),
      content: content ?? draft,
    })
  }

  // ── Step renders ──────────────────────────────────────────────────

  // Step 1: 목적 선택
  if (step === 'purpose') return (
    <Shell onClose={onClose} progress={progress} onBack={null}>
      <StepHeader
        title="글을 쓰는 목적이 무엇인가요?"
        sub="목적에 맞는 경로로 안내해드릴게요"
      />
      <div className="flex-1 flex flex-col justify-center gap-3 p-6">
        <BigButton
          onClick={() => { setFormat('웹소설'); goTo('genre') }}
          icon="💰" label="부업으로 수익을 내고 싶어요"
          sub="웹소설 경로로 바로 진입"
        />
        <BigButton
          onClick={() => goTo('format')}
          icon="✏️" label="취미 / 자기 만족 / 자기 계발"
          sub="다양한 글 형식 중에서 선택"
        />
        <BigButton
          onClick={() => { setAiExplain(PURPOSE_AI_EXPLAIN); goTo('purpose_ai_explain') }}
          icon="🤔" label="잘 모르겠어요"
          sub="AI가 각 형식을 설명해드릴게요"
        />
      </div>
      <SkipButton onClose={onClose} />
    </Shell>
  )

  // Step 1 → AI 설명 후 다시 선택
  if (step === 'purpose_ai_explain') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="글쓰기 형식 안내" sub="어떤 형식이 나에게 맞을지 살펴보세요" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-gray-300">
          {aiExplain}
          {aiExplainStreaming && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-indigo-400 align-middle" />}
        </div>
        <p className="mt-5 text-xs font-semibold text-gray-500 dark:text-gray-400">원하는 경로를 선택하세요</p>
        <div className="mt-2 flex flex-col gap-2">
          <BigButton onClick={() => { setFormat('웹소설'); goTo('genre') }} icon="📱" label="웹소설" sub="빠른 전개, 장르물, 연재" />
          <BigButton onClick={() => goTo('format')} icon="📚" label="순문학 / 추리 / 동화 등" sub="문학적 완성도 추구" />
          <BigButton onClick={() => { setFormat('일기 / 에세이'); goTo('has_draft') }} icon="📓" label="일기 / 에세이" sub="내 이야기 기록하기" />
        </div>
      </div>
      <SkipButton onClose={onClose} />
    </Shell>
  )

  // 글 형식 선택 (취미/자기계발 경로)
  if (step === 'format') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="어떤 형식으로 쓸까요?" sub="원하는 글 형식을 선택해주세요" />
      <div className="flex-1 flex flex-col justify-center gap-2.5 p-6">
        <BigButton onClick={() => { setFormat('웹소설'); goTo('genre') }} icon="📱" label="웹소설" sub="온라인 연재 소설" />
        <BigButton onClick={() => { setFormat('순문학 / 장르 문학'); goTo('has_draft') }} icon="📖" label="순문학 / 추리 / 동화 / 시나리오" sub="문학 장르" />
        <BigButton onClick={() => { setFormat('일기 / 에세이'); goTo('has_draft') }} icon="📓" label="일기 / 에세이" sub="생활 글쓰기" />
      </div>
      <SkipButton onClose={onClose} />
    </Shell>
  )

  // Step 2: 장르 선택 (웹소설 경로)
  if (step === 'genre') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="생각해둔 장르가 있나요?" sub="장르를 선택하면 맞춤 초안을 만들어드려요" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* 남성향 */}
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">남성향</p>
          <div className="space-y-1.5">
            {MALE_GENRES.map(({ id, desc }) => (
              <GenreRow key={id} label={id} desc={desc} active={genreDetail === id}
                onClick={() => { setGenderPath('남성향'); setGenreDetail(id); goTo('has_draft') }} />
            ))}
          </div>
        </div>
        {/* 여성향 */}
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">여성향</p>
          <div className="space-y-1.5">
            {FEMALE_GENRES.map(({ id, desc }) => (
              <GenreRow key={id} label={id} desc={desc} active={genreDetail === id}
                onClick={() => { setGenderPath('여성향'); setGenreDetail(id); goTo('has_draft') }} />
            ))}
          </div>
        </div>
        {/* 모르겠어요 */}
        <button
          onClick={() => goTo('genre_first_time')}
          className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 dark:border-gray-600 dark:hover:border-indigo-700"
        >
          🤔 모르겠어요
        </button>
      </div>
      <SkipButton onClose={onClose} />
    </Shell>
  )

  // 장르 처음이신가요?
  if (step === 'genre_first_time') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="웹소설이 처음이신가요?" sub="간단하게 장르를 설명해드릴까요?" />
      <div className="flex-1 flex flex-col justify-center gap-3 p-6">
        <BigButton
          onClick={() => { explainGenres(); goTo('genre_ai_explain') }}
          icon="✨" label="네, 설명해주세요"
          sub="AI가 각 장르를 한 줄씩 알려드려요"
        />
        <BigButton
          onClick={() => goBack()}
          icon="📋" label="아니요, 직접 선택할게요"
          sub="장르 목록으로 돌아가기"
        />
      </div>
    </Shell>
  )

  // AI 장르 설명
  if (step === 'genre_ai_explain') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="웹소설 장르 안내" sub="마음에 드는 장르를 선택하세요" />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-gray-300">
          {aiExplain || (aiExplainStreaming ? '' : '장르 설명을 불러오는 중…')}
          {aiExplainStreaming && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-indigo-400 align-middle" />}
        </div>
        {!aiExplainStreaming && (
          <>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">장르 선택</p>
            <div className="space-y-1.5">
              {[...MALE_GENRES, ...FEMALE_GENRES].map(({ id, desc }) => (
                <GenreRow key={id} label={id} desc={desc} active={genreDetail === id}
                  onClick={() => { setGenreDetail(id); goTo('has_draft') }} />
              ))}
            </div>
          </>
        )}
      </div>
      <SkipButton onClose={onClose} />
    </Shell>
  )

  // Step 3-1: 초안이 있나요?
  if (step === 'has_draft') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="초안을 작성해 볼까요?" sub="이미 쓴 글이 있으신가요?" />
      <div className="flex-1 flex flex-col justify-center gap-3 p-6">
        <BigButton
          onClick={() => goTo('existing_paste')}
          icon="📄" label="네, 초안이 있어요"
          sub="AI가 검토하고 개선을 도와드려요"
        />
        <BigButton
          onClick={() => goTo('help_offer')}
          icon="✏️" label="아니요, 처음부터 시작할게요"
          sub="AI와 함께 첫 장면을 만들어요"
        />
      </div>
    </Shell>
  )

  // 기존 유저: 초안 붙여넣기
  if (step === 'existing_paste') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="초안을 붙여넣어주세요" sub="AI가 내용을 분석하고 개선을 도와드려요" />
      <div className="flex-1 flex flex-col p-6 gap-3">
        <textarea
          value={existingDraft}
          onChange={(e) => setExistingDraft(e.target.value)}
          placeholder="초안 내용을 여기에 붙여넣어주세요…"
          rows={10}
          className="flex-1 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="작품 제목 (선택)"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
        />
      </div>
      <div className="shrink-0 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
        <button
          onClick={() => goTo('existing_help')}
          disabled={!existingDraft.trim()}
          className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          다음 →
        </button>
      </div>
    </Shell>
  )

  // 기존 유저: 도움 유형 선택
  if (step === 'existing_help') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="어떤 도움이 필요하신가요?" sub="원하는 개선 유형을 선택해주세요" />
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {EXISTING_HELP_OPTIONS.map(({ id, desc }) => (
          <button
            key={id}
            onClick={() => setSelectedHelp(id)}
            className={`w-full rounded-xl border p-4 text-left transition ${
              selectedHelp === id
                ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950'
                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-indigo-800 dark:hover:bg-gray-800'
            }`}
          >
            <p className={`text-sm font-medium ${selectedHelp === id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}>{id}</p>
            <p className="mt-0.5 text-xs text-gray-400">{desc}</p>
          </button>
        ))}
      </div>
      <div className="shrink-0 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
        <button
          onClick={() => goTo('existing_result')}
          disabled={!selectedHelp}
          className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          ✨ AI 개선 시작
        </button>
      </div>
    </Shell>
  )

  // 기존 유저: 결과 + 수정 루프
  if (step === 'existing_result') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title={selectedHelp} sub="AI가 초안을 개선했어요. 추가 요청도 가능해요." />
      <DraftArea draft={draft} streaming={draftStreaming} error={draftError} onRetry={runExistingHelp} />
      <RefineBar
        value={refineInput}
        onChange={setRefineInput}
        onSubmit={refineDraft}
        streaming={draftStreaming || refineStreaming}
      />
      {draft && !draftStreaming && !refineStreaming && (
        <div className="shrink-0 flex gap-2 border-t border-gray-100 px-4 py-4 dark:border-gray-700">
          <button
            onClick={() => handleCreate(draft)}
            className="flex-1 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
          >
            이 내용으로 에디터 열기 →
          </button>
          <CopyButton text={draft} />
        </div>
      )}
    </Shell>
  )

  // Step 3-2: 도움 제안 (초안 없음 경로)
  if (step === 'help_offer') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader title="AI가 도와드릴까요?" sub="작품 뼈대부터 첫 장면까지 함께 만들어드려요" />
      <div className="flex-1 flex flex-col justify-center gap-3 p-6">
        <BigButton
          onClick={() => { setBoneIdx(0); setBoneInput(''); goTo('backbone') }}
          icon="🤖" label="네, 함께 만들어주세요"
          sub="4가지 질문으로 작품 뼈대 구성"
        />
        <BigButton
          onClick={() => { setDraft(''); handleCreate('') }}
          icon="✏️" label="아니요, 직접 쓸게요"
          sub="빈 에디터로 바로 시작"
        />
      </div>
    </Shell>
  )

  // Step 3-3: 뼈대 만들기 (4가지 질문)
  if (step === 'backbone') {
    const q = BACKBONE_QUESTIONS[boneIdx]
    const isLast = boneIdx === BACKBONE_QUESTIONS.length - 1

    function saveBoneAndNext() {
      const updated = backbone.map((v, i) => i === boneIdx ? boneInput.trim() : v)
      setBackbone(updated)
      if (isLast) {
        setDraft('')
        goTo('draft')
      } else {
        setBoneIdx(boneIdx + 1)
        setBoneInput(backbone[boneIdx + 1] ?? '')
      }
    }

    function backBone() {
      if (boneIdx === 0) goBack()
      else {
        setBoneIdx(boneIdx - 1)
        setBoneInput(backbone[boneIdx - 1] ?? '')
      }
    }

    return (
      <Shell onClose={onClose} progress={progress} onBack={backBone}>
        {/* 진행 표시 */}
        <div className="shrink-0 border-b border-gray-100 px-6 pt-6 pb-4 dark:border-gray-700">
          <div className="flex items-center gap-1.5 mb-3">
            {BACKBONE_QUESTIONS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= boneIdx ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
            ))}
          </div>
          <span className="inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-400">
            {q.badge}
          </span>
          <h2 className="mt-2 text-base font-bold text-gray-800 dark:text-gray-100">{q.q}</h2>
          <p className="mt-1 text-xs text-gray-400">{q.hint}</p>
        </div>

        <div className="flex-1 flex flex-col p-6 gap-3">
          <textarea
            autoFocus
            value={boneInput}
            onChange={(e) => setBoneInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) saveBoneAndNext() }}
            placeholder={q.example}
            rows={4}
            className="flex-1 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
          />
          <p className="text-[10px] text-gray-300 dark:text-gray-700">{q.example}</p>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 dark:border-gray-700 space-y-2">
          <button
            onClick={saveBoneAndNext}
            className="w-full rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
          >
            {isLast ? '✨ 초안 생성하기' : `다음 (${boneIdx + 1}/4) →`}
          </button>
          {boneInput.trim() === '' && (
            <button
              onClick={() => {
                const updated = backbone.map((v, i) => i === boneIdx ? '' : v)
                setBackbone(updated)
                saveBoneAndNext()
              }}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              건너뛰기
            </button>
          )}
        </div>
      </Shell>
    )
  }

  // Step 3-4/3-5: 초안 생성 + 수정 루프
  if (step === 'draft') return (
    <Shell onClose={onClose} progress={progress} onBack={goBack}>
      <StepHeader
        title="첫 장면 초안"
        sub={draft ? '마음에 드지 않으면 아래에서 수정 요청하세요' : ''}
        action={
          !draftStreaming && !draft ? (
            <button
              onClick={generateDraft}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              ✨ 생성하기
            </button>
          ) : undefined
        }
      />

      {/* 제목 입력 */}
      {!draftStreaming && !draft && (
        <div className="shrink-0 px-6 pb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="작품 제목 (선택)"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
          />
        </div>
      )}

      <DraftArea draft={draft} streaming={draftStreaming} error={draftError} onRetry={generateDraft} />

      {(draft || draftStreaming) && (
        <RefineBar
          value={refineInput}
          onChange={setRefineInput}
          onSubmit={refineDraft}
          streaming={draftStreaming || refineStreaming}
        />
      )}

      {draft && !draftStreaming && !refineStreaming && (
        <div className="shrink-0 flex gap-2 border-t border-gray-100 px-4 py-4 dark:border-gray-700">
          <button
            onClick={() => handleCreate()}
            className="flex-1 rounded-xl bg-indigo-600 py-3 font-medium text-white hover:bg-indigo-700"
          >
            이 초안으로 에디터 열기 →
          </button>
          <button
            onClick={generateDraft}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            재생성
          </button>
          <CopyButton text={draft} />
        </div>
      )}

      {!draft && !draftStreaming && (
        <div className="shrink-0 border-t border-gray-100 px-4 py-4 dark:border-gray-700">
          <button
            onClick={() => handleCreate('')}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            빈 에디터로 시작하기
          </button>
        </div>
      )}
    </Shell>
  )

  return null
}

// ── Sub-components ─────────────────────────────────────────────────

function Shell({
  children, onClose, onBack, progress,
}: {
  children: React.ReactNode
  onClose: () => void
  onBack: (() => void) | null
  progress: number
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-gray-900/60 sm:p-4 backdrop-blur-sm">
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:max-w-lg h-[92dvh] sm:h-auto sm:max-h-[90vh]"
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        {/* 진행 바 */}
        <div className="absolute left-0 top-0 z-10 h-1 w-full overflow-hidden rounded-t-2xl bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${(progress / TOTAL) * 100}%` }}
          />
        </div>
        {/* 뒤로가기 */}
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ← 뒤로
          </button>
        )}
        {/* 닫기 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          ✕
        </button>
        <div className="flex flex-1 flex-col overflow-hidden pt-1">
          {children}
        </div>
      </div>
    </div>
  )
}

function StepHeader({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="shrink-0 border-b border-gray-100 px-6 py-5 dark:border-gray-700">
      <div className="flex items-start justify-between gap-4 pt-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h2>
          {sub && <p className="mt-0.5 text-sm text-gray-400">{sub}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}

function BigButton({ onClick, icon, label, sub }: {
  onClick: () => void; icon: string; label: string; sub?: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-700 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </button>
  )
}

function GenreRow({ label, desc, active, onClick }: {
  label: string; desc: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-3.5 text-left transition ${
        active
          ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950'
          : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-indigo-800 dark:hover:bg-gray-800'
      }`}
    >
      <p className={`text-sm font-medium ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}>{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
    </button>
  )
}

function DraftArea({ draft, streaming, error, onRetry }: {
  draft: string; streaming: boolean; error: string; onRetry: () => void
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {!draft && !streaming && !error && (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-600 text-center">
            AI가 첫 장면을 작성해드릴게요
          </p>
        </div>
      )}
      {!draft && streaming && (
        <div className="flex flex-col items-center justify-center gap-3 h-32">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-500" />
          <p className="text-xs text-gray-400">Gemini가 작성 중…</p>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={onRetry} className="mt-2 block underline">다시 시도</button>
        </div>
      )}
      {draft && (
        <div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-loose whitespace-pre-wrap text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {draft}
            {streaming && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-current align-middle" />}
          </div>
        </div>
      )}
    </div>
  )
}

function RefineBar({ value, onChange, onSubmit, streaming }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; streaming: boolean
}) {
  return (
    <div className="shrink-0 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={streaming}
          placeholder="수정 요청… (예: 더 긴장감 있게, 도입부만 바꿔줘)"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
        />
        <button
          type="submit"
          disabled={!value.trim() || streaming}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          ↵
        </button>
      </form>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
      title="복사"
    >
      {copied ? '✓' : '⎘'}
    </button>
  )
}

function SkipButton({ onClose }: { onClose: () => void }) {
  return (
    <div className="shrink-0 pb-3 text-center">
      <button
        onClick={onClose}
        className="text-xs text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500"
      >
        나중에 결정할게요
      </button>
    </div>
  )
}
