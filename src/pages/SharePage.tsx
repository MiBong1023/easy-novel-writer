import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import DarkModeToggle from '@/components/DarkModeToggle'

interface ShareData {
  novelTitle: string
  episodeTitle: string
  content: string
}

export default function SharePage() {
  const { shareId } = useParams<{ shareId: string }>()
  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!shareId) return
    getDoc(doc(db, 'shares', shareId)).then((snap) => {
      if (!snap.exists()) {
        setNotFound(true)
      } else {
        setData({
          novelTitle: snap.data().novelTitle as string,
          episodeTitle: snap.data().episodeTitle as string,
          content: snap.data().content as string,
        })
      }
      setLoading(false)
    })
  }, [shareId])

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-400">로딩 중…</div>
  }
  if (notFound || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-gray-400">
        <p className="text-4xl">🔗</p>
        <p className="text-sm">공유된 글을 찾을 수 없어요.</p>
        <Link to="/" className="text-xs text-indigo-500 hover:underline">홈으로 →</Link>
      </div>
    )
  }

  const lines = data.content.split('\n')

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 px-6 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">
            {data.novelTitle && <span className="mr-1">{data.novelTitle} ·</span>}
            <span className="font-medium text-gray-700 dark:text-gray-200">{data.episodeTitle}</span>
          </p>
          <DarkModeToggle />
        </div>
      </header>

      <article className="mx-auto max-w-[640px] px-8 py-14">
        <h1 className="mb-12 text-center text-2xl font-bold text-gray-800 dark:text-gray-100">
          {data.episodeTitle}
        </h1>
        <div className="space-y-0 text-[17px] leading-[2.1] tracking-wide text-gray-800 dark:text-gray-200">
          {lines.map((line, i) =>
            line.trim() === '' ? (
              <div key={i} className="h-5" />
            ) : (
              <p key={i}>{line}</p>
            )
          )}
        </div>
        {data.content.trim() === '' && (
          <p className="text-center text-sm italic text-gray-300 dark:text-gray-700">아직 내용이 없어요.</p>
        )}
      </article>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400 dark:border-gray-800 dark:text-gray-600">
        <Link to="/" className="hover:text-indigo-500">쉬운 소설 작가</Link>에서 작성된 글
      </footer>
    </div>
  )
}
