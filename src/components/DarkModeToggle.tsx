import { useDarkMode } from '@/hooks/useDarkMode'

export default function DarkModeToggle() {
  const { dark, toggle } = useDarkMode()

  return (
    <button
      onClick={toggle}
      aria-label="다크모드 전환"
      className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )
}
