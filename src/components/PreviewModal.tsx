import { useEffect } from 'react'

interface Props {
  title: string
  content: string
  onClose: () => void
}

export default function PreviewModal({ title, content, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const lines = content.split('\n')

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-gray-950">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/90 px-6 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Esc 닫기
        </button>
      </div>

      {/* 본문 */}
      <article className="mx-auto max-w-[640px] px-8 py-14">
        <h1 className="mb-12 text-center text-2xl font-bold text-gray-800 dark:text-gray-100">{title}</h1>
        <div className="space-y-0 text-[17px] leading-[2.1] tracking-wide text-gray-800 dark:text-gray-200">
          {lines.map((line, i) =>
            line.trim() === '' ? (
              <div key={i} className="h-5" />
            ) : (
              <p key={i}>{line}</p>
            )
          )}
        </div>
        {content.trim() === '' && (
          <p className="text-center text-sm italic text-gray-300 dark:text-gray-700">아직 내용이 없어요.</p>
        )}
      </article>
    </div>
  )
}
