interface Props {
  onClose: () => void
}

const shortcuts = [
  { keys: ['Cmd', 'F'], desc: '찾기 / 바꾸기 열기' },
  { keys: ['Tab'], desc: '들여쓰기 (2칸 공백)' },
  { keys: ['"'], desc: '스마트 따옴표 자동 변환 (자동변환 ON)' },
  { keys: ['...'], desc: '줄임표(…) 자동 변환 (자동변환 ON)' },
  { keys: ['--'], desc: '긴 대시(—) 자동 변환 (자동변환 ON)' },
  { keys: ['Esc'], desc: '집중 모드 해제 / 패널 닫기' },
]

export default function ShortcutsModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">단축키</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-3">
          {shortcuts.map(({ keys, desc }) => (
            <li key={desc} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">{desc}</span>
              <div className="flex shrink-0 items-center gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-xs text-gray-400 dark:text-gray-600">
          Mac: Cmd · Windows/Linux: Ctrl
        </p>
      </div>
    </div>
  )
}
