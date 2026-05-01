import { Link } from 'react-router-dom'
import type { Novel } from '@/types'

interface Props {
  novel: Novel
  onDelete: (id: string) => void
}

export default function NovelCard({ novel, onDelete }: Props) {
  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <Link to={`/novels/${novel.id}`} className="block">
        <h2 className="mb-1 text-lg font-semibold text-gray-800 group-hover:text-indigo-600 dark:text-gray-100 dark:group-hover:text-indigo-400">
          {novel.title}
        </h2>
        <p className="line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
          {novel.description || '설명 없음'}
        </p>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          {novel.episodeCount}화 · {new Date(novel.updatedAt).toLocaleDateString('ko-KR')}
        </p>
      </Link>
      <button
        onClick={() => onDelete(novel.id)}
        className="absolute right-3 top-3 rounded p-1 text-gray-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100 dark:text-gray-600"
        aria-label="삭제"
      >
        ✕
      </button>
    </div>
  )
}
