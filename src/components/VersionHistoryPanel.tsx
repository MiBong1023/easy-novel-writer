import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface Version {
  id: string
  content: string
  charCount: number
  savedAt: Date
}

interface Props {
  novelId: string
  episodeId: string
  userId: string
  onRestore: (content: string) => void
  onClose: () => void
}

function fmt(d: Date) {
  return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function VersionHistoryPanel({ novelId, episodeId, userId, onRestore, onClose }: Props) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ref = collection(db, 'users', userId, 'novels', novelId, 'episodes', episodeId, 'versions')
    getDocs(query(ref, orderBy('savedAt', 'desc'), limit(20))).then((snap) => {
      setVersions(snap.docs.map((d) => ({
        id: d.id,
        content: d.data().content as string,
        charCount: d.data().charCount as number,
        savedAt: d.data().savedAt?.toDate() ?? new Date(),
      })))
      setLoading(false)
    })
  }, [novelId, episodeId, userId])

  function handleRestore(v: Version) {
    if (!window.confirm(`${fmt(v.savedAt)} 버전으로 복원할까요?\n현재 내용이 덮어씌워집니다.`)) return
    onRestore(v.content)
    onClose()
  }

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">버전 기록</span>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="mt-16 text-center text-sm text-gray-400">불러오는 중…</div>
        ) : versions.length === 0 ? (
          <div className="mt-16 px-4 text-center text-sm text-gray-400">
            <p className="mb-2 text-2xl">📝</p>
            <p>저장된 버전이 없어요.</p>
            <p className="mt-1 text-xs">글을 쓰면 5분마다 자동 저장됩니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {versions.map((v) => (
              <li key={v.id} className="group flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{fmt(v.savedAt)}</p>
                  <p className="text-xs text-gray-400">{v.charCount.toLocaleString()}자</p>
                </div>
                <button
                  onClick={() => handleRestore(v)}
                  className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 opacity-0 transition group-hover:opacity-100 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-400"
                >
                  복원
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
