import type { SpellError } from '@/hooks/useSpellCheck'

interface Props {
  checking: boolean
  errors: SpellError[]
  errataCount: number
  checked: boolean
  apiError: string | null
  onApply: (error: SpellError, index: number) => void
  onApplyAll: () => void
  onRecheck: () => void
  onClose: () => void
}

const TYPE_LABEL: Record<string, string> = {
  yellow: '맞춤법',
  red: '문법',
  green: '띄어쓰기',
  blue: '표준어',
}

const TYPE_COLOR: Record<string, string> = {
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

export default function SpellCheckPanel({
  checking, errors, errataCount, checked, apiError,
  onApply, onApplyAll, onRecheck, onClose,
}: Props) {
  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">맞춤법 검사</span>
        <div className="flex items-center gap-2">
          {checked && !checking && (
            <button
              onClick={onRecheck}
              className="text-xs text-indigo-500 hover:text-indigo-700"
            >
              다시 검사
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {checking && (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <div className="mb-3 text-3xl">🔍</div>
            <p className="text-sm">검사 중…</p>
            <p className="mt-1 text-xs text-gray-300">텍스트가 길면 시간이 걸릴 수 있어요</p>
          </div>
        )}

        {!checking && apiError && (
          <div className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {apiError}
          </div>
        )}

        {!checking && checked && !apiError && (
          <>
            {errors.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <div className="mb-3 text-3xl">✅</div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">오류가 없습니다!</p>
                {errataCount > 0 && (
                  <p className="mt-2 px-4 text-center text-xs text-gray-400">
                    ({errataCount}개 항목 감지됐으나 자동 교정이 불가한 형태입니다)
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{errors.length}개 오류 발견</span>
                  <button
                    onClick={onApplyAll}
                    className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    전체 교정
                  </button>
                </div>
                <ul className="space-y-2">
                  {errors.map((e, i) => (
                    <li key={i} className="rounded-lg border border-gray-100 p-3 dark:border-gray-700">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-red-500 line-through break-all">{e.original}</span>
                          <span className="mx-1.5 text-xs text-gray-400">→</span>
                          <span className="text-sm font-medium text-green-600 dark:text-green-400 break-all">{e.correction}</span>
                        </div>
                        <button
                          onClick={() => onApply(e, i)}
                          className="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600"
                        >
                          교정
                        </button>
                      </div>
                      {e.help && (
                        <p className="mb-1 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{e.help}</p>
                      )}
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${TYPE_COLOR[e.errorType] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {TYPE_LABEL[e.errorType] ?? '오류'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
