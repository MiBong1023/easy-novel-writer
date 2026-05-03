import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import Editor from '@/components/Editor'
import NotesPanel from '@/components/NotesPanel'
import AuthButton from '@/components/AuthButton'
import DarkModeToggle from '@/components/DarkModeToggle'
import type { Episode } from '@/types'

export default function EditorPage() {
  const { novelId, episodeId } = useParams<{ novelId: string; episodeId: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [siblings, setSiblings] = useState<{ id: string; order: number }[]>([])
  const [fetching, setFetching] = useState(true)
  const [notesOpen, setNotesOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const contentRef = useRef('')

  useEffect(() => {
    if (!loading && !user) { navigate('/'); return }
  }, [loading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !novelId || !episodeId) return
    setFetching(true)
    const epRef = doc(db, 'users', user.uid, 'novels', novelId, 'episodes', episodeId)
    const listRef = collection(db, 'users', user.uid, 'novels', novelId, 'episodes')
    Promise.all([
      getDoc(epRef),
      getDocs(query(listRef, orderBy('order', 'asc'))),
    ]).then(([snap, listSnap]) => {
      if (snap.exists()) {
        const data = snap.data()
        const ep: Episode = {
          id: snap.id,
          ...(data as Omit<Episode, 'id'>),
          createdAt: data.createdAt?.toDate() ?? new Date(),
          updatedAt: data.updatedAt?.toDate() ?? new Date(),
        }
        setEpisode(ep)
        contentRef.current = ep.content
      }
      setSiblings(listSnap.docs.map((d) => ({ id: d.id, order: d.data().order ?? 0 })))
      setFetching(false)
    })
  }, [user, novelId, episodeId])

  // Esc로 집중 모드 해제
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  function handleExport() {
    if (!episode) return
    const blob = new Blob([contentRef.current], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${episode.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading || fetching) {
    return <div className="flex h-screen items-center justify-center text-gray-400">로딩 중…</div>
  }

  if (!episode || !user || !novelId || !episodeId) {
    return <div className="flex h-screen items-center justify-center text-gray-400">회차를 찾을 수 없어요.</div>
  }

  const currentIdx = siblings.findIndex((s) => s.id === episodeId)
  const prevEp = currentIdx > 0 ? siblings[currentIdx - 1] : null
  const nextEp = currentIdx >= 0 && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      {/* 헤더: 집중 모드일 때 숨김 */}
      {!focusMode && (
        <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <Link
            to={`/novels/${novelId}`}
            className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ← 목록
          </Link>
          <span className="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">
            {episode.title}
          </span>
          {prevEp && (
            <button
              onClick={() => navigate(`/novels/${novelId}/episodes/${prevEp.id}`)}
              title="이전 회차"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              ‹
            </button>
          )}
          {nextEp && (
            <button
              onClick={() => navigate(`/novels/${novelId}/episodes/${nextEp.id}`)}
              title="다음 회차"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              ›
            </button>
          )}
          <button
            onClick={() => setNotesOpen((v) => !v)}
            title="작품 메모"
            className={`rounded-lg p-2 text-sm transition hover:bg-gray-100 dark:hover:bg-gray-800 ${notesOpen ? 'text-indigo-500' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            🗒️
          </button>
          <button
            onClick={handleExport}
            title="txt로 내보내기"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ↓ txt
          </button>
          <DarkModeToggle />
          <AuthButton user={user} />
        </header>
      )}

      <div className="relative flex-1 overflow-hidden">
        <Editor
          novelId={novelId}
          episodeId={episodeId}
          initialContent={episode.content}
          userId={user.uid}
          onContentChange={(v) => { contentRef.current = v }}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode(true)}
        />
        {!focusMode && notesOpen && (
          <NotesPanel
            novelId={novelId}
            userId={user.uid}
            onClose={() => setNotesOpen(false)}
          />
        )}

        {/* 집중 모드 나가기 버튼 */}
        {focusMode && (
          <button
            onClick={() => setFocusMode(false)}
            title="집중 모드 해제"
            className="fixed right-5 top-5 z-50 rounded-lg px-3 py-1.5 text-xs text-gray-300 opacity-40 transition-all duration-200 hover:bg-gray-100 hover:opacity-100 hover:text-gray-600 dark:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            Esc
          </button>
        )}
      </div>
    </div>
  )
}
