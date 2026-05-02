import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
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
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [fetching, setFetching] = useState(true)
  const [notesOpen, setNotesOpen] = useState(false)
  const contentRef = useRef('')

  useEffect(() => {
    if (!user || !novelId || !episodeId) return
    const ref = doc(db, 'users', user.uid, 'novels', novelId, 'episodes', episodeId)
    getDoc(ref).then((snap) => {
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
      setFetching(false)
    })
  }, [user, novelId, episodeId])

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

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
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
      <div className="relative flex-1 overflow-hidden">
        <Editor
          novelId={novelId}
          episodeId={episodeId}
          initialContent={episode.content}
          userId={user.uid}
          onContentChange={(v) => { contentRef.current = v }}
        />
        {notesOpen && (
          <NotesPanel
            novelId={novelId}
            userId={user.uid}
            onClose={() => setNotesOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
