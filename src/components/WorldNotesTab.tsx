import { useEffect, useState } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const CATEGORIES = ['배경', '설정', '규칙', '용어', '기타'] as const
type Category = typeof CATEGORIES[number]

const CAT_COLORS: Record<Category, string> = {
  '배경': 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300',
  '설정': 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
  '규칙': 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
  '용어': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
  '기타': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

interface WorldNote {
  id: string
  category: Category
  title: string
  body: string
}

interface Props { uid: string; novelId: string }

const EMPTY_FORM = { category: '배경' as Category, title: '', body: '' }

export default function WorldNotesTab({ uid, novelId }: Props) {
  const [notes, setNotes] = useState<WorldNote[]>([])
  const [filterCat, setFilterCat] = useState<Category | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

  useEffect(() => {
    const ref = collection(db, 'users', uid, 'novels', novelId, 'worldNotes')
    getDocs(ref).then((snap) =>
      setNotes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorldNote, 'id'>) })))
    )
  }, [uid, novelId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    const ref = collection(db, 'users', uid, 'novels', novelId, 'worldNotes')
    const docRef = await addDoc(ref, { ...form, title: form.title.trim(), body: form.body.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    setNotes((prev) => [...prev, { id: docRef.id, category: form.category, title: form.title.trim(), body: form.body.trim() }])
    setForm(EMPTY_FORM)
    setAdding(false)
  }

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, 'users', uid, 'novels', novelId, 'worldNotes', id))
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  function startEdit(n: WorldNote) {
    setEditingId(n.id)
    setEditForm({ category: n.category, title: n.title, body: n.body })
  }

  async function commitEdit() {
    if (!editingId || !editForm.title.trim()) { setEditingId(null); return }
    await updateDoc(doc(db, 'users', uid, 'novels', novelId, 'worldNotes', editingId), {
      ...editForm, title: editForm.title.trim(), body: editForm.body.trim(), updatedAt: serverTimestamp(),
    })
    setNotes((prev) => prev.map((n) => n.id === editingId ? { ...n, ...editForm, title: editForm.title.trim(), body: editForm.body.trim() } : n))
    setEditingId(null)
  }

  const visible = filterCat === 'all' ? notes : notes.filter((n) => n.category === filterCat)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="전체" active={filterCat === 'all'} onClick={() => setFilterCat('all')} />
          {CATEGORIES.map((c) => (
            <FilterChip key={c} label={c} active={filterCat === c} onClick={() => setFilterCat(c)} color={filterCat === c ? CAT_COLORS[c] : undefined} />
          ))}
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="ml-auto shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            + 추가
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="mb-4 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
          <CatSelector value={form.category} onChange={(c) => setForm((f) => ({ ...f, category: c }))} />
          <input autoFocus placeholder="제목 *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
          <textarea placeholder="내용" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={3}
            className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">추가</button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-500 dark:border-gray-600">취소</button>
          </div>
        </form>
      )}

      {visible.length === 0 && !adding && (
        <p className="mt-12 text-center text-sm text-gray-400 dark:text-gray-600">세계관 설정을 기록해보세요</p>
      )}

      <ul className="space-y-2">
        {visible.map((n) => (
          <li key={n.id} className="group rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            {editingId === n.id ? (
              <div className="space-y-2">
                <CatSelector value={editForm.category} onChange={(c) => setEditForm((f) => ({ ...f, category: c }))} />
                <input autoFocus value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium focus:outline-none dark:border-indigo-600 dark:bg-gray-700 dark:text-gray-200"
                />
                <textarea value={editForm.body} onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))} rows={4}
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
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CAT_COLORS[n.category]}`}>{n.category}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{n.title}</span>
                  </div>
                  {n.body && <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-500 dark:text-gray-400">{n.body}</p>}
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={() => startEdit(n)} className="rounded p-1 text-gray-400 hover:text-indigo-500">✎</button>
                  <button onClick={() => handleDelete(n.id)} className="rounded p-1 text-gray-400 hover:text-red-500">✕</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function CatSelector({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${value === c ? CAT_COLORS[c] + ' ring-2 ring-indigo-400 ring-offset-1' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${active && color ? color : active ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'}`}
    >
      {label}
    </button>
  )
}
