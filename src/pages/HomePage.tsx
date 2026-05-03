import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
import { useGoogleLogin } from '@/hooks/useGoogleLogin'
import NovelCard from '@/components/NovelCard'
import DarkModeToggle from '@/components/DarkModeToggle'
import type { Novel, NovelColor } from '@/types'

// ── 랜딩 페이지 ──────────────────────────────────────────────

function LandingPage() {
  const { loginWithGoogle, loading } = useGoogleLogin()

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
      {/* 배경 글로우 */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
        <div className="h-[500px] w-[800px] rounded-full bg-indigo-500/10 blur-[100px] dark:bg-indigo-500/8" />
      </div>

      {/* 헤더 */}
      <header className="relative flex items-center justify-between px-8 py-6">
        <span className="text-sm font-medium text-gray-400 dark:text-gray-600">쉬운 소설 작가</span>
        <DarkModeToggle />
      </header>

      {/* 히어로 */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-4 text-center">
        {/* 뱃지 */}
        <div className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-400">
          <span>✦</span>
          <span>한국어 소설 창작 전용 에디터</span>
        </div>

        {/* 타이틀 */}
        <h1 className="mb-6 text-5xl font-bold leading-[1.15] tracking-tight text-gray-900 dark:text-white sm:text-6xl lg:text-7xl">
          글쓰기에만
          <br />
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-indigo-300">
            집중하세요
          </span>
        </h1>

        {/* 서브타이틀 */}
        <p className="mb-10 max-w-xs text-lg leading-relaxed text-gray-500 dark:text-gray-400 sm:max-w-sm">
          방해 없는 깔끔한 에디터로
          <br />
          소설 쓰는 일에만 온전히 몰입하세요.
        </p>

        {/* 기능 태그 */}
        <div className="mb-12 flex flex-wrap justify-center gap-2">
          {['자동 저장', '버전 기록', '맞춤법 검사', '찾기 / 바꾸기', '다크 모드'].map((f) => (
            <span
              key={f}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400"
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={loginWithGoogle}
          disabled={loading}
          className="flex items-center gap-3 rounded-2xl bg-gray-900 px-8 py-4 text-base font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-lg active:translate-y-0 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          <GoogleIcon />
          {loading ? '로그인 중…' : 'Google로 시작하기'}
        </button>

        <p className="mt-5 text-xs text-gray-400 dark:text-gray-600">
          Google 계정으로 간편하게 · 설치 불필요
        </p>
      </main>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

// ── 작품 목록 ─────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth()
  const [novels, setNovels] = useState<Novel[]>([])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'episodes'>('updated')
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

  async function handleColorChange(id: string, color: NovelColor) {
    if (!user) return
    await updateDoc(doc(db, 'users', user.uid, 'novels', id), { color })
    setNovels((prev) => prev.map((n) => (n.id === id ? { ...n, color } : n)))
  }

  async function handleDelete(id: string) {
    if (!user || !window.confirm('작품을 삭제할까요? 모든 회차와 기록이 함께 삭제됩니다.')) return
    setNovels((prev) => prev.filter((n) => n.id !== id))
    const uid = user.uid
    const [epSnap, notesSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'novels', id, 'episodes')),
      getDocs(collection(db, 'users', uid, 'novels', id, 'notes')),
    ])
    await Promise.all([
      ...epSnap.docs.map(async (ep) => {
        const versionsSnap = await getDocs(collection(db, 'users', uid, 'novels', id, 'episodes', ep.id, 'versions'))
        await Promise.all(versionsSnap.docs.map((v) => deleteDoc(v.ref)))
        return deleteDoc(ep.ref)
      }),
      ...notesSnap.docs.map((n) => deleteDoc(n.ref)),
    ])
    await deleteDoc(doc(db, 'users', uid, 'novels', id))
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-400">로딩 중…</div>
  }

  // 비로그인 → 랜딩 페이지
  if (!user) {
    return <LandingPage />
  }

  const filteredNovels = (
    search.trim()
      ? novels.filter((n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.description?.toLowerCase().includes(search.toLowerCase()),
        )
      : [...novels]
  ).sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title, 'ko')
    if (sortBy === 'episodes') return b.episodeCount - a.episodeCount
    return b.updatedAt.getTime() - a.updatedAt.getTime()
  })

  // 로그인 완료 → 작품 목록
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">쉬운 소설 작가</h1>
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <Link
              to="/stats"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              통계
            </Link>
            <button
              onClick={() => setCreating(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:scale-95"
            >
              + 새 작품
            </button>
            {/* 로그아웃 등은 AuthButton 대신 간단하게 처리 */}
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {/* 검색 + 정렬 */}
        {!creating && novels.length > 0 && (
          <div className="mb-6 flex gap-2">
            <input
              type="search"
              placeholder="작품 검색…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
            />
            <div className="flex rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
              {(['updated', 'title', 'episodes'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-3 py-2 text-xs transition-colors ${
                    sortBy === key
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {key === 'updated' ? '최근' : key === 'title' ? '제목' : '회차'}
                </button>
              ))}
            </div>
          </div>
        )}

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
            <p className="mb-4 text-4xl">📖</p>
            <p>아직 작품이 없어요. 새 작품을 만들어보세요!</p>
          </div>
        ) : filteredNovels.length === 0 ? (
          <div className="mt-16 text-center text-gray-400 dark:text-gray-600">
            <p className="mb-2 text-2xl">🔍</p>
            <p className="text-sm">
              <span className="font-medium text-gray-600 dark:text-gray-400">"{search}"</span>에 해당하는 작품이 없어요.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredNovels.map((n) => (
              <NovelCard key={n.id} novel={n} onDelete={handleDelete} onRename={handleRename} onColorChange={handleColorChange} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── 유저 메뉴 (우상단 프로필) ───────────────────────────────────

import { signOut, auth as firebaseAuth } from '@/lib/firebase'
import type { User } from '@/lib/firebase'

function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="focus:outline-none">
        {user.photoURL ? (
          <img src={user.photoURL} alt="프로필" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
            {user.displayName?.[0] ?? 'U'}
          </div>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <p className="truncate px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
              {user.displayName ?? user.email}
            </p>
            <hr className="border-gray-100 dark:border-gray-700" />
            <button
              onClick={() => signOut(firebaseAuth)}
              className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  )
}
