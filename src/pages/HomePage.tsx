import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import NovelCard from '@/components/NovelCard'
import AuthButton from '@/components/AuthButton'
import DarkModeToggle from '@/components/DarkModeToggle'
import type { Novel } from '@/types'

export default function HomePage() {
  const { user, loading, authError } = useAuth()
  const [novels, setNovels] = useState<Novel[]>([])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const novelsRef = user ? collection(db, 'users', user.uid, 'novels') : null

  useEffect(() => {
    if (!novelsRef) return
    getDocs(query(novelsRef, orderBy('updatedAt', 'desc'))).then((snap) => {
      setNovels(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Novel, 'id'>),
          createdAt: d.data().createdAt?.toDate() ?? new Date(),
          updatedAt: d.data().updatedAt?.toDate() ?? new Date(),
        })),
      )
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!novelsRef || !title.trim()) return
    try {
      const ref = await addDoc(novelsRef, {
        title: title.trim(),
        description: desc.trim(),
        userId: user!.uid,
        episodeCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      navigate(`/novels/${ref.id}`)
    } catch {
      setError('작품 생성에 실패했습니다. 다시 시도해주세요.')
    }
  }

  async function handleRename(id: string, newTitle: string) {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid, 'novels', id), {
      title: newTitle,
      updatedAt: serverTimestamp(),
    })
    setNovels((prev) => prev.map((n) => (n.id === id ? { ...n, title: newTitle } : n)))
  }

  async function handleDelete(id: string) {
    if (!user || !window.confirm('작품을 삭제할까요?')) return
    await deleteDoc(doc(db, 'users', user.uid, 'novels', id))
    setNovels((prev) => prev.filter((n) => n.id !== id))
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-400">로딩 중…</div>
  }

  if (authError) {
    return <div className="flex h-screen items-center justify-center text-red-500">{authError}</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">쉬운 소설 작가</h1>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <button
              onClick={() => setCreating(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95"
            >
              + 새 작품
            </button>
            {user && <AuthButton user={user} />}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {creating && (
          <form
            onSubmit={handleCreate}
            className="mb-8 rounded-xl border border-indigo-200 bg-white p-5 shadow dark:border-indigo-900 dark:bg-gray-800"
          >
            <h2 className="mb-4 font-semibold text-gray-700 dark:text-gray-200">새 작품 만들기</h2>
            <input
              autoFocus
              required
              placeholder="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <textarea
              placeholder="간단한 설명 (선택)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="mb-4 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            {error && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                만들기
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
              >
                취소
              </button>
            </div>
          </form>
        )}

        {novels.length === 0 ? (
          <div className="mt-20 text-center text-gray-400 dark:text-gray-600">
            <p className="text-4xl mb-4">📖</p>
            <p>아직 작품이 없어요. 새 작품을 만들어보세요!</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {novels.map((n) => (
              <NovelCard key={n.id} novel={n} onDelete={handleDelete} onRename={handleRename} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
