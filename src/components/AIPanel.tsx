import { useEffect } from 'react'
import { useAI } from '@/hooks/useAI'

interface Props {
  value: string
  selectedText: string
  onInsert: (text: string) => void
  onClose: () => void
}

export default function AIPanel({ value, selectedText, onInsert, onClose }: Props) {
  const { status, result, errorMsg, run, reset } = useAI()

  // 패널 열리면 즉시 이어쓰기 실행
  useEffect(() => {
    const context = value.slice(-600)
    run(context, 'continue')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRefine() {
    const text = selectedText || value.slice(-400)
    run(text, 'refine')
  }

  function handleContinue() {
    const context = value.slice(-600)
    run(context, 'continue')
  }

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">AI 글쓰기 보조</span>
          <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400">
            Claude
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-700">
        <button
          onClick={handleContinue}
          disabled={status === 'loading'}
          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950"
        >
          이어쓰기
        </button>
        <button
          onClick={handleRefine}
          disabled={status === 'loading'}
          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950"
        >
          문장 다듬기
        </button>
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto p-4">
        {status === 'idle' && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-600 mt-8">
            버튼을 눌러 AI 도움을 받아보세요.
          </p>
        )}
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 mt-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-500" />
            <p className="text-xs text-gray-400">Claude가 작성 중…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-xs text-red-600 dark:text-red-400">{errorMsg}</p>
            <button
              onClick={handleContinue}
              className="mt-2 text-xs text-red-500 underline hover:text-red-700"
            >
              다시 시도
            </button>
          </div>
        )}
        {status === 'done' && result && (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-600">
              제안
            </p>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {result}
            </div>
          </div>
        )}
      </div>

      {/* 삽입 버튼 */}
      {status === 'done' && result && (
        <div className="flex gap-2 border-t border-gray-100 px-3 py-3 dark:border-gray-700">
          <button
            onClick={() => { onInsert(result); reset() }}
            className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            삽입
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            다시
          </button>
        </div>
      )}
    </div>
  )
}
