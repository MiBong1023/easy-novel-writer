import { useEffect, useState } from 'react'
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

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

interface Props { uid: string; novelId: string }

const EMPTY_FORM = { name: '', role: '주인공' as Role, description: '' }

export default function CharactersTab({ uid, novelId }: Props) {
  const [chars, setChars] = useState<Character[]>([])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState(EMPTY_FORM)

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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{chars.length}명</span>
        {!adding && (
          <button onClick={() => setAdding(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            + 인물 추가
          </button>
        )}
      </div>

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

      {chars.length === 0 && !adding && (
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
