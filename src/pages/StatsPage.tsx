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

interface NovelStat {
  id: string
  title: string
  episodeCount: number
  totalChars: number
  color?: string
}

function getStreak(stats: DayStat[]): number {
  const map = new Map(stats.map((s) => [s.date, s.charsAdded]))
  let streak = 0
  const d = new Date()
  const todayKey = d.toISOString().slice(0, 10)
  if (!map.get(todayKey)) d.setDate(d.getDate() - 1)
  while (true) {
    const key = d.toISOString().slice(0, 10)
    if ((map.get(key) ?? 0) > 0) { streak++; d.setDate(d.getDate() - 1) }
    else break
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

const COLOR_BAR: Record<string, string> = {
  indigo: 'bg-indigo-400', rose: 'bg-rose-400', emerald: 'bg-emerald-400',
  amber: 'bg-amber-400', violet: 'bg-violet-400', sky: 'bg-sky-400',
}

export default function StatsPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DayStat[]>([])
  const [novelStats, setNovelStats] = useState<NovelStat[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) { navigate('/'); return }
  }, [loading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    Promise.all([
      getDocs(collection(db, 'users', user.uid, 'stats')),
      getDocs(collection(db, 'users', user.uid, 'novels')),
    ]).then(async ([statsSnap, novelsSnap]) => {
      setStats(statsSnap.docs.map((d) => d.data() as DayStat))

      const results = await Promise.all(
        novelsSnap.docs.map(async (novelDoc) => {
          const epSnap = await getDocs(collection(db, 'users', user.uid, 'novels', novelDoc.id, 'episodes'))
          const totalChars = epSnap.docs.reduce((sum, ep) => sum + ((ep.data().charCount as number) || 0), 0)
          return {
            id: novelDoc.id,
            title: novelDoc.data().title as string,
            episodeCount: novelDoc.data().episodeCount as number ?? 0,
            totalChars,
            color: novelDoc.data().color as string | undefined,
          }
        })
      )
      setNovelStats(results.filter((n) => n.totalChars > 0).sort((a, b) => b.totalChars - a.totalChars))
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

  const maxNovelChars = Math.max(...novelStats.map((n) => n.totalChars), 1)

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

      <main className="mx-auto max-w-2xl space-y-6 p-6">

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
                  {value > 0 && (
                    <div className="pointer-events-none absolute bottom-full mb-1 hidden rounded bg-gray-800 px-1.5 py-0.5 text-xs text-white group-hover:block dark:bg-gray-600">
                      {value.toLocaleString()}자
                    </div>
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${
                      isToday ? 'bg-indigo-500' : value > 0 ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-gray-100 dark:bg-gray-700'
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

        {/* 작품별 현황 */}
        {novelStats.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-gray-600 dark:text-gray-300">작품별 현황</h2>
            <ul className="space-y-3">
              {novelStats.map((n) => {
                const barWidth = Math.max((n.totalChars / maxNovelChars) * 100, 2)
                const barColor = COLOR_BAR[n.color ?? 'indigo'] ?? 'bg-indigo-400'
                return (
                  <li key={n.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Link
                        to={`/novels/${n.id}`}
                        className="truncate text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-200 dark:hover:text-indigo-400"
                      >
                        {n.title}
                      </Link>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
                        <span>{n.episodeCount}화</span>
                        <span className="font-medium text-gray-600 dark:text-gray-300">
                          {n.totalChars.toLocaleString()}자
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

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
