import { useEffect, useRef, useState } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callGemini, msg, isAILimitReached } from '@/lib/gemini'

interface PlotItem {
  id: string
  text: string
  done: boolean
  order: number
}

interface Props { uid: string; novelId: string }

const PLOT_SYSTEM = `당신은 한국어 소설 분석 전문가입니다. 주어진 소설 내용을 분석하여 주요 플롯 포인트를 추출하세요.
각 플롯 포인트는 한 문장으로 간결하게 작성하고, JSON 배열로만 반환하세요:
["플롯 포인트 1", "플롯 포인트 2", ...]
- 5~10개의 핵심 사건/전환점을 추출하세요
- 시간 순서대로 정렬하세요
- JSON 배열만 출력하고 다른 설명은 하지 마세요`

export default function PlotTab({ uid, novelId }: Props) {
  const [items, setItems] = useState<PlotItem[]>([])
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ref = collection(db, 'users', uid, 'novels', novelId, 'plotItems')
    getDocs(query(ref, orderBy('order', 'asc'))).then((snap) =>
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PlotItem, 'id'>) })))
    )
  }, [uid, novelId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    const ref = collection(db, 'users', uid, 'novels', novelId, 'plotItems')
    const docRef = await addDoc(ref, {
      text: newText.trim(), done: false,
      order: items.length + 1, createdAt: serverTimestamp(),
    })
    setItems((prev) => [...prev, { id: docRef.id, text: newText.trim(), done: false, order: prev.length + 1 }])
    setNewText('')
    inputRef.current?.focus()
  }

  async function toggleDone(item: PlotItem) {
    const done = !item.done
    await updateDoc(doc(db, 'users', uid, 'novels', novelId, 'plotItems', item.id), { done })
    setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, done } : p))
  }

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, 'users', uid, 'novels', novelId, 'plotItems', id))
    setItems((prev) => prev.filter((p) => p.id !== id))
  }

  async function commitEdit(id: string) {
    if (!editText.trim()) { setEditingId(null); return }
    await updateDoc(doc(db, 'users', uid, 'novels', novelId, 'plotItems', id), { text: editText.trim() })
    setItems((prev) => prev.map((p) => p.id === id ? { ...p, text: editText.trim() } : p))
    setEditingId(null)
  }

  async function handleAIAnalyze() {
    if (isAILimitReached()) { setAnalyzeError('오늘의 AI 사용 한도를 초과했습니다.'); return }
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const epRef = collection(db, 'users', uid, 'novels', novelId, 'episodes')
      const snap = await getDocs(query(epRef, orderBy('order', 'asc')))
      const episodes = snap.docs.map((d) => d.data() as { summary?: string; excerpt?: string; content?: string; title?: string; order?: number })
      if (episodes.length === 0) { setAnalyzeError('회차 내용이 없습니다. 먼저 소설을 작성해주세요.'); return }

      const combined = episodes.slice(0, 10)
        .map((ep, i) => {
          const text = ep.summary ?? ep.excerpt ?? (ep.content ?? '').slice(0, 500)
          return `${ep.title ?? `${i + 1}화`}: ${text}`
        })
        .join('\n')

      const raw = await callGemini([msg('user', combined)], PLOT_SYSTEM)
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('AI 응답을 파싱할 수 없습니다.')

      const parsed = JSON.parse(match[0]) as string[]
      const valid = parsed.filter((p) => typeof p === 'string' && p.trim())
      if (valid.length === 0) throw new Error('추출된 플롯이 없습니다.')

      const existingTexts = new Set(items.map((p) => p.text))
      const ref = collection(db, 'users', uid, 'novels', novelId, 'plotItems')
      let nextOrder = items.length + 1
      const added: PlotItem[] = []
      for (const text of valid) {
        if (existingTexts.has(text)) continue
        const docRef = await addDoc(ref, {
          text, done: false, order: nextOrder, createdAt: serverTimestamp(),
        })
        added.push({ id: docRef.id, text, done: false, order: nextOrder })
        nextOrder++
      }
      setItems((prev) => [...prev, ...added])
    } catch (e) {
      setAnalyzeError((e as Error).message || 'AI 분석 중 오류가 발생했습니다.')
    } finally {
      setAnalyzing(false)
    }
  }

  const doneCount = items.filter((p) => p.done).length

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-3 flex gap-2">
        <input
          ref={inputRef}
          placeholder="플롯 포인트 추가… (Enter)"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
        />
        <button type="submit" disabled={!newText.trim()}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          +
        </button>
      </form>

      <div className="mb-3 flex items-center justify-between">
        {items.length > 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-600">
            {doneCount}/{items.length} 완료{doneCount === items.length && items.length > 0 ? ' 🎉' : ''}
          </p>
        ) : <span />}
        <button
          onClick={handleAIAnalyze}
          disabled={analyzing || isAILimitReached()}
          className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-40 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/60"
        >
          {analyzing ? '분석 중…' : 'AI 분석'}
        </button>
      </div>

      {analyzeError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {analyzeError}
        </div>
      )}

      {items.length === 0 && (
        <p className="mt-12 text-center text-sm text-gray-400 dark:text-gray-600">플롯 포인트를 추가해보세요</p>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={() => toggleDone(item)}
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                item.done
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-gray-300 hover:border-indigo-400 dark:border-gray-600'
              }`}
            >
              {item.done && <span className="text-[10px] leading-none">✓</span>}
            </button>

            {editingId === item.id ? (
              <input autoFocus value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => commitEdit(item.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(item.id); if (e.key === 'Escape') setEditingId(null) }}
                className="flex-1 rounded-lg border border-indigo-300 bg-transparent px-2 py-0.5 text-sm focus:outline-none dark:border-indigo-600 dark:text-gray-200"
              />
            ) : (
              <span
                onDoubleClick={() => { setEditingId(item.id); setEditText(item.text) }}
                className={`flex-1 text-sm leading-relaxed ${item.done ? 'text-gray-400 line-through dark:text-gray-600' : 'text-gray-700 dark:text-gray-200'}`}
              >
                {item.text}
              </span>
            )}

            {editingId !== item.id && (
              <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={() => { setEditingId(item.id); setEditText(item.text) }} className="rounded p-1 text-gray-400 hover:text-indigo-500">✎</button>
                <button onClick={() => handleDelete(item.id)} className="rounded p-1 text-gray-400 hover:text-red-500">✕</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
