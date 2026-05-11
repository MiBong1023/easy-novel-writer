import { useEffect, useState } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callGemini, msg, isAILimitReached } from '@/lib/gemini'

const ROLES = ['주인공', '조연', '악당', '기타'] as const
type Role = typeof ROLES[number]

const ROLE_COLORS: Record<Role, string> = {
  '주인공': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
  '조연':   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
  '악당':   'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',
  '기타':   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

interface Character {
  id: string
  name: string
  role: Role
  description: string
  order: number
}

interface ExtractedChar { name: string; role: Role; description: string; selected: boolean }

interface Props { uid: string; novelId: string }

const EMPTY_FORM = { name: '', role: '주인공' as Role, description: '' }

const EXTRACT_SYSTEM = `당신은 한국 웹소설 전문 분석가입니다. 주어진 소설 본문에서 등장인물을 추출하여 JSON 배열로 반환하세요.

역할(role) 분류 기준:
- 주인공: 이야기 중심 인물 1명. 유형: 조용한 무쌍형 / 착각물 주인공형 / 회귀자형 / 빙의자형 / 먼치킨형 / 밑바닥 성장형 / 전문가형
- 조연: 주인공과 관계 형성 인물. 유형: 차가운 미녀형 / 밝은 조력자형 / 라이벌형 / 천연순수형 / 소꿉친구형 / 스승형 / 이중성 조연형
- 악당: 주인공과 대립하는 인물. 유형: 조직형 중간 빌런 / 웃는 얼굴 빌런형 / 신념형 빌런 / 최종 흑막형
- 기타: 그 외 단역·배경 인물

각 인물에 대해 다음 형식으로 작성하세요:
[{"name":"이름","role":"주인공|조연|악당|기타","description":"인물 설명 (외모, 성격, 아키타입 특징, 주인공과의 관계 등)"}]
- role은 반드시 주인공/조연/악당/기타 중 하나여야 합니다
- 주인공은 1명만 선택하세요
- JSON 배열만 출력하고 다른 설명은 하지 마세요`

export default function CharactersTab({ uid, novelId }: Props) {
  const [chars, setChars] = useState<Character[]>([])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedChar[]>([])
  const [extractError, setExtractError] = useState('')

  useEffect(() => {
    const ref = collection(db, 'users', uid, 'novels', novelId, 'characters')
    getDocs(query(ref, orderBy('order', 'asc'))).then((snap) =>
      setChars(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Character, 'id'>) })))
    )
  }, [uid, novelId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const ref = collection(db, 'users', uid, 'novels', novelId, 'characters')
    const docRef = await addDoc(ref, {
      name: form.name.trim(), role: form.role,
      description: form.description.trim(),
      order: chars.length + 1, createdAt: serverTimestamp(),
    })
    setChars((prev) => [...prev, { id: docRef.id, name: form.name.trim(), role: form.role, description: form.description.trim(), order: prev.length + 1 }])
    setForm(EMPTY_FORM)
    setAdding(false)
  }

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, 'users', uid, 'novels', novelId, 'characters', id))
    setChars((prev) => prev.filter((c) => c.id !== id))
  }

  function startEdit(c: Character) {
    setEditingId(c.id)
    setEditForm({ name: c.name, role: c.role, description: c.description })
  }

  async function commitEdit() {
    if (!editingId || !editForm.name.trim()) { setEditingId(null); return }
    await updateDoc(doc(db, 'users', uid, 'novels', novelId, 'characters', editingId), {
      name: editForm.name.trim(), role: editForm.role, description: editForm.description.trim(),
    })
    setChars((prev) => prev.map((c) => c.id === editingId ? { ...c, ...editForm, name: editForm.name.trim(), description: editForm.description.trim() } : c))
    setEditingId(null)
  }

  async function handleAIExtract() {
    if (isAILimitReached()) { setExtractError('오늘의 AI 사용 한도를 초과했습니다.'); return }
    setExtracting(true)
    setExtractError('')
    setExtracted([])
    try {
      const epRef = collection(db, 'users', uid, 'novels', novelId, 'episodes')
      const snap = await getDocs(query(epRef, orderBy('order', 'asc')))
      const episodes = snap.docs.map((d) => d.data() as { content?: string; title?: string; order?: number })
      if (episodes.length === 0) { setExtractError('회차 내용이 없습니다. 먼저 소설을 작성해주세요.'); return }

      const combined = episodes.slice(0, 5)
        .map((ep, i) => `=== ${ep.title ?? `${i + 1}화`} ===\n${(ep.content ?? '').slice(0, 3000)}`)
        .join('\n\n')

      const raw = await callGemini([msg('user', combined)], EXTRACT_SYSTEM)
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('AI 응답을 파싱할 수 없습니다.')

      const parsed = JSON.parse(match[0]) as Array<{ name: string; role: string; description: string }>
      const existingNames = new Set(chars.map((c) => c.name))
      const valid = parsed
        .filter((p) => p.name && ROLES.includes(p.role as Role))
        .map((p) => ({
          name: p.name,
          role: p.role as Role,
          description: p.description ?? '',
          selected: !existingNames.has(p.name),
        }))

      if (valid.length === 0) throw new Error('추출된 인물이 없습니다.')
      setExtracted(valid)
    } catch (e) {
      setExtractError((e as Error).message || 'AI 추출 중 오류가 발생했습니다.')
    } finally {
      setExtracting(false)
    }
  }

  async function saveExtracted() {
    const toSave = extracted.filter((e) => e.selected)
    if (toSave.length === 0) { setExtracted([]); return }
    const existingNames = new Set(chars.map((c) => c.name))
    const ref = collection(db, 'users', uid, 'novels', novelId, 'characters')
    let nextOrder = chars.length + 1
    const added: Character[] = []
    for (const e of toSave) {
      if (existingNames.has(e.name)) continue
      const docRef = await addDoc(ref, {
        name: e.name, role: e.role, description: e.description,
        order: nextOrder, createdAt: serverTimestamp(),
      })
      added.push({ id: docRef.id, name: e.name, role: e.role, description: e.description, order: nextOrder })
      nextOrder++
    }
    setChars((prev) => [...prev, ...added])
    setExtracted([])
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{chars.length}명</span>
        <div className="flex gap-2">
          <button
            onClick={handleAIExtract}
            disabled={extracting || isAILimitReached()}
            className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-40 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
          >
            {extracting ? '분석 중…' : 'AI로 추출'}
          </button>
          {!adding && (
            <button onClick={() => setAdding(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
              + 인물 추가
            </button>
          )}
        </div>
      </div>

      {extractError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {extractError}
        </div>
      )}

      {extracted.length > 0 && (
        <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800 dark:bg-purple-950/30">
          <p className="mb-3 text-sm font-medium text-purple-700 dark:text-purple-300">AI가 추출한 등장인물</p>
          <ul className="space-y-2">
            {extracted.map((e, i) => (
              <li key={i} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setExtracted((prev) => prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p))}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                    e.selected ? 'border-purple-500 bg-purple-500 text-white' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {e.selected && <span className="text-[10px] leading-none">✓</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{e.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[e.role]}`}>{e.role}</span>
                    {chars.some((c) => c.name === e.name) && (
                      <span className="text-[10px] text-gray-400">이미 존재</span>
                    )}
                  </div>
                  {e.description && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{e.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveExtracted}
              className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
            >
              선택 항목 저장
            </button>
            <button
              onClick={() => setExtracted([])}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-500 dark:border-gray-600"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {adding && (
        <form onSubmit={handleAdd} className="mb-4 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
          <input autoFocus placeholder="이름 *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
          <RoleSelector value={form.role} onChange={(r) => setForm((f) => ({ ...f, role: r }))} />
          <textarea placeholder="인물 설명 (외모, 성격, 배경 등)" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">추가</button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-500 dark:border-gray-600">취소</button>
          </div>
        </form>
      )}

      {chars.length === 0 && !adding && extracted.length === 0 && (
        <p className="mt-12 text-center text-sm text-gray-400 dark:text-gray-600">등장인물을 추가해보세요</p>
      )}

      <ul className="space-y-2">
        {chars.map((c) => (
          <li key={c.id} className="group rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            {editingId === c.id ? (
              <div className="space-y-2">
                <input autoFocus value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium focus:outline-none dark:border-indigo-600 dark:bg-gray-700 dark:text-gray-200"
                />
                <RoleSelector value={editForm.role} onChange={(r) => setEditForm((f) => ({ ...f, role: r }))} />
                <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                />
                <div className="flex gap-2">
                  <button onClick={commitEdit} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">저장</button>
                  <button onClick={() => setEditingId(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 dark:border-gray-600">취소</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[c.role]}`}>{c.role}</span>
                  </div>
                  {c.description && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-500 dark:text-gray-400">{c.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => startEdit(c)} className="rounded p-1 text-gray-400 hover:text-indigo-500">✎</button>
                  <button onClick={() => handleDelete(c.id)} className="rounded p-1 text-gray-400 hover:text-red-500">✕</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function RoleSelector({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLES.map((r) => (
        <button key={r} type="button" onClick={() => onChange(r)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${value === r ? ROLE_COLORS[r] + ' ring-2 ring-indigo-400 ring-offset-1' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
