import { useEffect, useRef, useState } from 'react'
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

const DAILY_GOAL_KEY = 'daily-writing-goal'

export default function StatsPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DayStat[]>([])
  const [novelStats, setNovelStats] = useState<NovelStat[]>([])
  const [fetching, setFetching] = useState(true)
  const [dailyGoal, setDailyGoalState] = useState<number>(() =>
    parseInt(localStorage.getItem(DAILY_GOAL_KEY) ?? '1000', 10)
  )
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null)
  const goalNotifiedRef = useRef(false)

  function commitGoal() {
    const v = parseInt(goalInput, 10)
    if (!isNaN(v) && v > 0) {
      localStorage.setItem(DAILY_GOAL_KEY, String(v))
      setDailyGoalState(v)
    }
    setGoalEditing(false)
  }

  useEffect(() => {
    if ('Notification' in window) setNotifPermission(Notification.permission)
  }, [])

  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const todayKey = new Date().toISOString().slice(0, 10)
    const todayCharsVal = stats.find((s) => s.date === todayKey)?.charsAdded ?? 0
    if (todayCharsVal < dailyGoal || todayCharsVal === 0) return
    const notifKey = `goal-notif-${todayKey}`
    if (sessionStorage.getItem(notifKey) || goalNotifiedRef.current) return
    goalNotifiedRef.current = true
    new Notification('오늘의 목표 달성! 🎉', {
      body: `오늘 ${todayCharsVal.toLocaleString()}자를 썼어요. 목표 ${dailyGoal.toLocaleString()}자 달성!`,
    })
    sessionStorage.setItem(notifKey, '1')
  }, [stats, dailyGoal])

  async function requestNotifPermission() {
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }

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

  const lastWeekEndDate = new Date(); lastWeekEndDate.setDate(lastWeekEndDate.getDate() - 7)
  const lastWeekStartDate = new Date(); lastWeekStartDate.setDate(lastWeekStartDate.getDate() - 13)
  const lastWeekEndKey = lastWeekEndDate.toISOString().slice(0, 10)
  const lastWeekStartKey = lastWeekStartDate.toISOString().slice(0, 10)
  const lastWeekChars = stats.filter((s) => s.date >= lastWeekStartKey && s.date <= lastWeekEndKey).reduce((sum, s) => sum + s.charsAdded, 0)
  const weekDiff = weekChars - lastWeekChars
  const weekDiffPct = lastWeekChars > 0 ? Math.round(Math.abs(weekDiff / lastWeekChars) * 100) : null
  const maxWeek = Math.max(weekChars, lastWeekChars, 1)

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
          {/* 오늘 카드 — 일일 목표 포함 */}
          <div className={`rounded-xl border p-4 border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/50`}>
            <div className="mb-1 flex items-center justify-between gap-1">
              <p className="text-xs text-gray-400 dark:text-gray-500">오늘</p>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                <span>목표</span>
                {goalEditing ? (
                  <form onSubmit={(e) => { e.preventDefault(); commitGoal() }} className="inline">
                    <input
                      autoFocus
                      type="number"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                      onBlur={commitGoal}
                      className="w-14 rounded border border-indigo-300 bg-white px-1 text-[10px] text-gray-700 focus:outline-none dark:border-indigo-600 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => { setGoalInput(String(dailyGoal)); setGoalEditing(true) }}
                    className="underline decoration-dotted hover:text-indigo-500"
                    title="일일 목표 변경"
                  >
                    {dailyGoal.toLocaleString()}자
                  </button>
                )}
              </div>
            </div>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {todayChars.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-gray-400">자</span>
            </p>
            {/* 목표 달성 진행바 */}
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/50">
              <div
                className={`h-full rounded-full transition-all duration-500 ${todayChars >= dailyGoal ? 'bg-emerald-400' : 'bg-indigo-400'}`}
                style={{ width: `${Math.min((todayChars / dailyGoal) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-indigo-400 dark:text-indigo-500">
              {todayChars >= dailyGoal ? '🎉 목표 달성!' : `${Math.round((todayChars / dailyGoal) * 100)}%`}
            </p>
            {notifPermission === 'default' && (
              <button
                onClick={requestNotifPermission}
                className="mt-2 w-full rounded-lg bg-indigo-100 px-2 py-1 text-[10px] text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-900"
              >
                🔔 목표 알림 켜기
              </button>
            )}
            {notifPermission === 'denied' && (
              <p className="mt-1 text-[9px] text-gray-400 dark:text-gray-600">알림 차단됨</p>
            )}
          </div>
          <StatCard label="이번 주" value={weekChars.toLocaleString()} unit="자" />
          <StatCard label="누적" value={totalChars.toLocaleString()} unit="자" />
          <StatCard label="연속 작성" value={String(streak)} unit="일" />
        </div>

        {/* 주간 비교 */}
        {(weekChars > 0 || lastWeekChars > 0) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-gray-600 dark:text-gray-300">주간 비교</h2>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-right text-xs text-gray-400 dark:text-gray-500">지난 주</span>
                <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-gray-300 dark:bg-gray-600 transition-all duration-500"
                    style={{ width: `${(lastWeekChars / maxWeek) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">{lastWeekChars.toLocaleString()}자</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-right text-xs font-medium text-indigo-600 dark:text-indigo-400">이번 주</span>
                <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-indigo-400 dark:bg-indigo-500 transition-all duration-500"
                    style={{ width: `${(weekChars / maxWeek) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-medium text-indigo-600 dark:text-indigo-400">{weekChars.toLocaleString()}자</span>
              </div>
            </div>
            {weekDiffPct !== null && (
              <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                <span className={`font-semibold ${weekDiff >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {weekDiff >= 0 ? '▲' : '▼'} {weekDiffPct}%
                </span>{' '}
                지난 주 대비 {weekDiff >= 0
                  ? `${Math.abs(weekDiff).toLocaleString()}자 더 썼어요`
                  : `${Math.abs(weekDiff).toLocaleString()}자 덜 썼어요`}
              </p>
            )}
          </div>
        )}

        {/* 최근 14일 바 차트 */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-sm font-semibold text-gray-600 dark:text-gray-300">최근 14일</h2>
          <div className="relative" style={{ height: 148 }}>
            {/* 그리드 라인 */}
            {[50, 100].map((pct) => (
              <div
                key={pct}
                className="absolute w-full border-t border-dashed border-gray-100 dark:border-gray-700"
                style={{ bottom: `calc(${pct}% * 108 / 148 + 28px)` }}
              />
            ))}
            {/* 일일 목표 라인 */}
            {dailyGoal > 0 && dailyGoal <= maxVal && (
              <div
                className="absolute w-full border-t-2 border-dashed border-amber-300/70 dark:border-amber-600/50"
                style={{ bottom: `calc(${(dailyGoal / maxVal) * 100}% * 108 / 148 + 28px)` }}
              >
                <span className="absolute right-0 -top-3.5 text-[9px] text-amber-400 dark:text-amber-600">목표</span>
              </div>
            )}
            <div className="absolute bottom-7 flex w-full items-end justify-between gap-1" style={{ height: 108 }}>
              {chartData.map(({ date, value }) => {
                const isToday = date === today
                const heightPct = Math.max((value / maxVal) * 100, value > 0 ? 3 : 0)
                return (
                  <div key={date} className="group relative flex flex-1 flex-col items-center justify-end">
                    {/* 호버 툴팁 */}
                    {value > 0 && (
                      <div className="pointer-events-none absolute bottom-full mb-1.5 hidden whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white shadow group-hover:block dark:bg-gray-600">
                        {value.toLocaleString()}자
                      </div>
                    )}
                    {/* 오늘 마커 */}
                    {isToday && (
                      <span className="absolute -top-5 text-[9px] font-bold text-indigo-500 dark:text-indigo-400">▼</span>
                    )}
                    <div
                      className={`w-full rounded-t transition-all duration-300 ${
                        isToday
                          ? 'bg-indigo-500 dark:bg-indigo-400'
                          : value > 0
                          ? 'bg-indigo-300 hover:bg-indigo-400 dark:bg-indigo-700 dark:hover:bg-indigo-600'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                )
              })}
            </div>
            {/* 날짜 레이블 행 */}
            <div className="absolute bottom-0 flex w-full justify-between gap-1">
              {chartData.map(({ date }) => {
                const isToday = date === today
                return (
                  <div key={date} className="flex flex-1 justify-center">
                    <span className={`text-[10px] leading-none ${isToday ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {isToday ? '오늘' : formatDate(date)}
                    </span>
                  </div>
                )
              })}
            </div>
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

        {/* 연간 잔디 뷰 */}
        <YearGrid stats={stats} />

        {stats.length === 0 && (
          <p className="text-center text-sm text-gray-400 dark:text-gray-600">
            아직 기록이 없어요. 글을 쓰면 통계가 쌓입니다.
          </p>
        )}
      </main>
    </div>
  )
}

function YearGrid({ stats }: { stats: DayStat[] }) {
  const map = new Map(stats.map((s) => [s.date, s.charsAdded]))
  const today = new Date().toISOString().slice(0, 10)
  const year = new Date().getFullYear()

  // 올해 1월 1일부터 오늘까지 날짜 배열
  const dates: string[] = []
  const d = new Date(year, 0, 1)
  const end = new Date()
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }

  // 1월 1일의 요일만큼 앞에 빈칸 채우기 (0=일)
  const startDay = new Date(year, 0, 1).getDay()
  const padded: (string | null)[] = [...Array(startDay).fill(null), ...dates]

  // 7개씩 주(week) 단위로 분할
  const weeks: (string | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

  function cellColor(date: string | null) {
    if (!date) return ''
    const v = map.get(date) ?? 0
    if (v === 0) return 'bg-gray-100 dark:bg-gray-800'
    if (v < 500)  return 'bg-emerald-100 dark:bg-emerald-900/60'
    if (v < 1500) return 'bg-emerald-300 dark:bg-emerald-700'
    if (v < 3000) return 'bg-emerald-500'
    return 'bg-emerald-700 dark:bg-emerald-400'
  }

  const months = ['1','2','3','4','5','6','7','8','9','10','11','12']

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-sm font-semibold text-gray-600 dark:text-gray-300">{year}년 글쓰기 기록</h2>
      <div className="overflow-x-auto">
        <div className="flex gap-px" style={{ minWidth: `${weeks.length * 13}px` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-px">
              {week.map((date, di) => (
                <div
                  key={di}
                  title={date ? `${date.slice(5).replace('-','/')} · ${(map.get(date) ?? 0).toLocaleString()}자` : ''}
                  className={`h-3 w-3 rounded-sm transition-colors ${date ? cellColor(date) : ''} ${date === today ? 'ring-1 ring-indigo-400 ring-offset-[1px]' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
        {/* 월 레이블 */}
        <div className="mt-1.5 flex text-[9px] text-gray-400 dark:text-gray-600" style={{ minWidth: `${weeks.length * 13}px` }}>
          {weeks.map((week, wi) => {
            const firstDate = week.find(Boolean)
            if (!firstDate) return <div key={wi} style={{ width: 13 }} />
            const day = parseInt(firstDate.slice(8), 10)
            const month = parseInt(firstDate.slice(5, 7), 10)
            return (
              <div key={wi} style={{ width: 13 }} className="shrink-0">
                {day <= 7 ? months[month - 1] : ''}
              </div>
            )
          })}
        </div>
      </div>
      {/* 범례 */}
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
        <span>적게</span>
        {['bg-gray-100 dark:bg-gray-800','bg-emerald-100','bg-emerald-300','bg-emerald-500','bg-emerald-700'].map((c, i) => (
          <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />
        ))}
        <span>많이</span>
      </div>
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
