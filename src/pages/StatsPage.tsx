import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import DarkModeToggle from '@/components/DarkModeToggle'

interface DayStat {
  date: string   // YYYY-MM-DD
  charsAdded: number
}

function getStreak(stats: DayStat[]): number {
  const map = new Map(stats.map((s) => [s.date, s.charsAdded]))
  let streak = 0
  const d = new Date()
  // 오늘 기록이 없으면 어제부터 시작
  const todayKey = d.toISOString().slice(0, 10)
  if (!map.get(todayKey)) d.setDate(d.getDate() - 1)
  while (true) {
    const key = d.toISOString().slice(0, 10)
    if ((map.get(key) ?? 0) > 0) {
      streak++
      d.setDate(d.getDate() - 1)
    } else break
  }
  return streak
}

function last14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function StatsPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DayStat[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) { navigate('/'); return }
  }, [loading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    getDocs(collection(db, 'users', user.uid, 'stats')).then((snap) => {
      setStats(snap.docs.map((d) => d.data() as DayStat))
      setFetching(false)
    })
  }, [user])

  if (loading || fetching) {
    return <div className="flex h-screen items-center justify-center text-gray-400">로딩 중…</div>
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayChars = stats.find((s) => s.date === today)?.charsAdded ?? 0

  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  const weekKey = weekStart.toISOString().slice(0, 10)
  const weekChars = stats.filter((s) => s.date >= weekKey).reduce((sum, s) => sum + s.charsAdded, 0)

  const totalChars = stats.reduce((sum, s) => sum + s.charsAdded, 0)
  const streak = getStreak(stats)

  const days = last14Days()
  const map = new Map(stats.map((s) => [s.date, s.charsAdded]))
  const chartData = days.map((d) => ({ date: d, value: map.get(d) ?? 0 }))
  const maxVal = Math.max(...chartData.map((d) => d.value), 1)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link to="/" className="text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200">
            ← 목록
          </Link>
          <h1 className="flex-1 text-lg font-bold text-gray-800 dark:text-gray-100">글쓰기 통계</h1>
          <DarkModeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6 space-y-6">

        {/* 주요 지표 카드 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="오늘" value={todayChars.toLocaleString()} unit="자" highlight />
          <StatCard label="이번 주" value={weekChars.toLocaleString()} unit="자" />
          <StatCard label="누적" value={totalChars.toLocaleString()} unit="자" />
          <StatCard label="연속 작성" value={String(streak)} unit="일" />
        </div>

        {/* 최근 14일 바 차트 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold text-gray-600 dark:text-gray-300">최근 14일</h2>
          <div className="flex items-end justify-between gap-1" style={{ height: 120 }}>
            {chartData.map(({ date, value }) => {
              const isToday = date === today
              const heightPct = Math.max((value / maxVal) * 100, value > 0 ? 4 : 0)
              return (
                <div key={date} className="group relative flex flex-1 flex-col items-center justify-end gap-1">
                  {/* 툴팁 */}
                  {value > 0 && (
                    <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded bg-gray-800 px-1.5 py-0.5 text-xs text-white group-hover:block dark:bg-gray-600">
                      {value.toLocaleString()}자
                    </div>
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${
                      isToday
                        ? 'bg-indigo-500'
                        : value > 0
                          ? 'bg-indigo-300 dark:bg-indigo-700'
                          : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className={`text-[10px] ${isToday ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {formatDate(date)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {stats.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-600">
            아직 기록이 없어요. 글을 쓰면 통계가 쌓입니다.
          </p>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/50' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
      <p className="mb-1 text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-100'}`}>
        {value}
        <span className="ml-1 text-sm font-normal text-gray-400">{unit}</span>
      </p>
    </div>
  )
}
