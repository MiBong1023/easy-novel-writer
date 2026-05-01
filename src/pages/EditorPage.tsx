import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import Editor from '@/components/Editor'
import AuthButton from '@/components/AuthButton'
import type { Episode } from '@/types'

export default function EditorPage() {
  const { novelId, episodeId } = useParams<{ novelId: string; episodeId: string }>()
  const { user, loading } = useAuth()
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user || !novelId || !episodeId) return
    const ref = doc(db, 'users', user.uid, 'novels', novelId, 'episodes', episodeId)
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setEpisode({ id: snap.id, ...(snap.data() as Omit<Episode, 'id'>), createdAt: snap.data().createdAt?.toDate() ?? new Date(), updatedAt: snap.data().updatedAt?.toDate() ?? new Date() })
      }
      setFetching(false)
    })
  }, [user, novelId, episodeId])

  if (loading || fetching) {
    return <div className="flex h-screen items-center justify-center text-gray-400">로딩 중…</div>
  }

  if (!episode || !user || !novelId || !episodeId) {
    return <div className="flex h-screen items-center justify-center text-gray-400">회차를 찾을 수 없어요.</div>
  }

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <Link
          to={`/novels/${novelId}`}
          className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ← 목록
        </Link>
        <span className="flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-300">
          {episode.title}
        </span>
        <AuthButton user={user} />
      </header>
      <div className="flex-1 overflow-hidden">
        <Editor
          novelId={novelId}
          episodeId={episodeId}
          initialContent={episode.content}
          userId={user.uid}
        />
      </div>
    </div>
  )
}
