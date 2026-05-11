import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  getDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import AuthButton from '@/components/AuthButton'
import DarkModeToggle from '@/components/DarkModeToggle'
import WritingWizard, { type WizardResult } from '@/components/WritingWizard'
import CharactersTab from '@/components/CharactersTab'
import WorldNotesTab from '@/components/WorldNotesTab'
import PlotTab from '@/components/PlotTab'
import { streamGemini, msg, isAILimitReached } from '@/lib/gemini'
import type { Episode, Novel } from '@/types'

const REVIEW_SYSTEM = `당신은 한국어 소설 전문 편집자입니다. 주어진 소설의 전체 회차 요약을 분석하고 다음 항목을 리뷰해주세요:

1. **전체 완성도**: 작품의 전반적인 구성과 완성도
2. **인물 일관성**: 등장인물의 성격과 행동이 일관적인지
3. **플롯 흐름**: 이야기의 전개가 자연스럽고 논리적인지
4. **문체와 분위기**: 문체의 일관성과 분위기 조성
5. **개선 제안**: 구체적인 개선점 2~3가지

각 항목에 대해 구체적이고 건설적인 피드백을 제공하세요.`

type Tab = 'episodes' | 'characters' | 'world' | 'plot'
const TABS: { id: Tab; label: string }[] = [
  { id: 'episodes',   label: '회차' },
  { id: 'characters', label: '등장인물' },
  { id: 'world',      label: '세계관' },
  { id: 'plot',       label: '플롯' },
]

export default function NovelPage() {
  const { novelId } = useParams<{ novelId: string }>()
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [novel, setNovel] = useState<Novel | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [creating, setCreating] = useState(false)
  const [epTitle, setEpTitle] = useState('')
  const [editingEpId, setEditingEpId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [descEditing, setDescEditing] = useState(false)
  const [descDraft, setDescDraft] = useState('')
  const [epSearch, setEpSearch] = useState('')
  const [deepSearch, setDeepSearch] = useState(false)
  const [deepContents, setDeepContents] = useState<Record<string, string>>({})
  const [deepLoading, setDeepLoading] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [wizardOpen, setWizardOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('episodes')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [reviewResult, setReviewResult] = useState('')
  const [reviewError, setReviewError] = useState('')
  const reviewAbortRef = useRef<AbortController | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const touchDragRef = useRef<{ fromIndex: number } | null>(null)
  const [touchDragging, setTouchDragging] = useState<number | null>(null)

  useEffect(() => {
    if (!loading && !user) { navigate('/'); return }
  }, [loading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !novelId) return
    const novelRef = doc(db, 'users', user.uid, 'novels', novelId)
    getDoc(novelRef).then((snap) => {
      if (!snap.exists()) return
      setNovel({ id: snap.id, ...(snap.data() as Omit<Novel, 'id'>), createdAt: snap.data().createdAt?.toDate() ?? new Date(), updatedAt: snap.data().updatedAt?.toDate() ?? new Date() })
    })
    const epRef = collection(db, 'users', user.uid, 'novels', novelId, 'episodes')
    getDocs(query(epRef, orderBy('order', 'asc'))).then((snap) => {
      setEpisodes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Episode, 'id'>), excerpt: d.data().excerpt as string | undefined, createdAt: d.data().createdAt?.toDate() ?? new Date(), updatedAt: d.data().updatedAt?.toDate() ?? new Date() })))
    })
  }, [user, novelId])

  async function handleCreateEpisode(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !novelId || !epTitle.trim()) return
    const epRef = collection(db, 'users', user.uid, 'novels', novelId, 'episodes')
    const ref = await addDoc(epRef, {
      novelId,
      title: epTitle.trim(),
      content: '',
      order: episodes.length + 1,
      charCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await updateDoc(doc(db, 'users', user.uid, 'novels', novelId), {
      episodeCount: episodes.length + 1,
      updatedAt: serverTimestamp(),
    })
    navigate(`/novels/${novelId}/episodes/${ref.id}`)
  }

  function startEditEp(ep: Episode) {
    setEditingEpId(ep.id)
    setEditDraft(ep.title)
  }

  async function commitEditEp() {
    if (!user || !novelId || !editingEpId) return
    const trimmed = editDraft.trim()
    if (trimmed) {
      await updateDoc(doc(db, 'users', user.uid, 'novels', novelId, 'episodes', editingEpId), {
        title: trimmed,
        updatedAt: serverTimestamp(),
      })
      setEpisodes((prev) => prev.map((ep) => ep.id === editingEpId ? { ...ep, title: trimmed } : ep))
    }
    setEditingEpId(null)
  }

  function onEpKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitEditEp() }
    if (e.key === 'Escape') setEditingEpId(null)
  }

  async function handleExportAll() {
    if (!user || !novelId || episodes.length === 0) return
    setExportProgress({ current: 0, total: episodes.length })
    let completed = 0
    const epContents = await Promise.all(
      episodes.map(async (ep) => {
        const snap = await getDoc(doc(db, 'users', user.uid, 'novels', novelId, 'episodes', ep.id))
        const content = snap.exists() ? (snap.data().content as string) : ''
        completed++
        setExportProgress({ current: completed, total: episodes.length })
        return { ep, content }
      })
    )
    const lines: string[] = [`${novel?.title ?? '작품'}\n`]
    epContents
      .sort((a, b) => a.ep.order - b.ep.order)
      .forEach(({ ep, content }) => {
        lines.push(`${'='.repeat(40)}\n${ep.order}화 ${ep.title}\n${'='.repeat(40)}\n\n${content}`)
      })
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${novel?.title ?? '작품'}.txt`
    a.click()
    URL.revokeObjectURL(url)
    setExportProgress(null)
  }

  async function saveDesc() {
    setDescEditing(false)
    if (!user || !novelId || !novel) return
    const trimmed = descDraft.trim()
    if (trimmed === (novel.description ?? '')) return
    await updateDoc(doc(db, 'users', user.uid, 'novels', novelId), {
      description: trimmed,
      updatedAt: serverTimestamp(),
    })
    setNovel((prev) => prev ? { ...prev, description: trimmed } : prev)
  }

  async function handleReorderCleanup() {
    if (!user || !novelId || episodes.length === 0) return
    const updated = episodes.map((ep, i) => ({ ...ep, order: i + 1 }))
    setEpisodes(updated)
    await Promise.all(
      updated.map((ep) =>
        updateDoc(doc(db, 'users', user!.uid, 'novels', novelId!, 'episodes', ep.id), { order: ep.order })
      )
    )
  }

  async function loadDeepSearch() {
    if (!user || !novelId || deepLoading) return
    setDeepLoading(true)
    const contents: Record<string, string> = {}
    await Promise.all(
      episodes.map(async (ep) => {
        const snap = await getDoc(doc(db, 'users', user.uid, 'novels', novelId, 'episodes', ep.id))
        if (snap.exists()) contents[ep.id] = (snap.data().content as string) ?? ''
      })
    )
    setDeepContents(contents)
    setDeepSearch(true)
    setDeepLoading(false)
  }

  async function handleCopyEpisode(ep: Episode) {
    if (!user || !novelId) return
    const snap = await getDoc(doc(db, 'users', user.uid, 'novels', novelId, 'episodes', ep.id))
    const content = snap.exists() ? (snap.data().content as string) : ''
    const epRef = collection(db, 'users', user.uid, 'novels', novelId, 'episodes')
    // order를 원본 + 0.5로 설정해 원본 바로 아래에 삽입
    const newOrder = ep.order + 0.5
    const newRef = await addDoc(epRef, {
      novelId,
      title: `${ep.title} (복사본)`,
      content,
      order: newOrder,
      charCount: ep.charCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setEpisodes((prev) => {
      const idx = prev.findIndex((e) => e.id === ep.id)
      const newEp: Episode = {
        id: newRef.id, novelId: novelId!, title: `${ep.title} (복사본)`,
        content, order: newOrder, charCount: ep.charCount,
        createdAt: new Date(), updatedAt: new Date(),
      }
      return [...prev.slice(0, idx + 1), newEp, ...prev.slice(idx + 1)]
    })
  }

  async function handleWizardCreate({ title: epTitleFromWizard, content }: WizardResult) {
    if (!user || !novelId) return
    setWizardOpen(false)
    const order = episodes.length + 1
    const epRef = collection(db, 'users', user.uid, 'novels', novelId, 'episodes')
    const ref = await addDoc(epRef, {
      novelId,
      title: epTitleFromWizard || `${order}화`,
      content,
      order,
      charCount: content.length,
      excerpt: content.slice(0, 80),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    await updateDoc(doc(db, 'users', user.uid, 'novels', novelId), {
      episodeCount: order,
      updatedAt: serverTimestamp(),
    })
    navigate(`/novels/${novelId}/episodes/${ref.id}`)
  }


  async function handleDeleteEpisode(epId: string) {
    if (!user || !novelId || !window.confirm('회차를 삭제할까요?')) return
    await deleteDoc(doc(db, 'users', user.uid, 'novels', novelId, 'episodes', epId))
    setEpisodes((prev) => prev.filter((ep) => ep.id !== epId))
  }

  async function handleBatchDelete() {
    if (!user || !novelId || selectedIds.size === 0) return
    if (!window.confirm(`선택한 ${selectedIds.size}개 회차를 삭제할까요?`)) return
    await Promise.all(
      [...selectedIds].map((id) => deleteDoc(doc(db, 'users', user!.uid, 'novels', novelId!, 'episodes', id)))
    )
    setEpisodes((prev) => prev.filter((ep) => !selectedIds.has(ep.id)))
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }


  function handleDragStart(index: number) {
    dragIndexRef.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    const from = dragIndexRef.current
    if (from === null || from === index) return
    setEpisodes((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(index, 0, moved)
      return next.map((ep, i) => ({ ...ep, order: i + 1 }))
    })
    dragIndexRef.current = index
  }

  async function handleAIReview() {
    if (!user || !novelId) return
    if (isAILimitReached()) { setReviewError('오늘의 AI 사용 한도를 초과했습니다.'); return }
    reviewAbortRef.current?.abort()
    const ctrl = new AbortController()
    reviewAbortRef.current = ctrl
    setReviewing(true)
    setReviewResult('')
    setReviewError('')
    try {
      const epRef = collection(db, 'users', user.uid, 'novels', novelId, 'episodes')
      const snap = await getDocs(query(epRef, orderBy('order', 'asc')))
      const eps = snap.docs.map((d) => d.data() as { summary?: string; excerpt?: string; content?: string; title?: string; order?: number })
      if (eps.length === 0) { setReviewError('회차 내용이 없습니다.'); setReviewing(false); return }
      const combined = `소설 제목: ${novel?.title ?? '제목 없음'}\n\n` + eps.map((ep, i) => {
        const text = ep.summary ?? ep.excerpt ?? (ep.content ?? '').slice(0, 400)
        return `${ep.title ?? `${i + 1}화`}: ${text}`
      }).join('\n\n')
      let accumulated = ''
      await streamGemini([msg('user', combined)], REVIEW_SYSTEM, (chunk) => {
        accumulated += chunk
        setReviewResult(accumulated)
      }, ctrl.signal)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setReviewError((e as Error).message || 'AI 리뷰 중 오류가 발생했습니다.')
      }
    } finally {
      setReviewing(false)
    }
  }

  async function handleDragEnd() {
    dragIndexRef.current = null
    if (!user || !novelId) return
    setEpisodes((prev) => {
      prev.forEach((ep, i) => {
        updateDoc(doc(db, 'users', user!.uid, 'novels', novelId!, 'episodes', ep.id), {
          order: i + 1,
        }).catch(() => {})
      })
      return prev
    })
  }

  function handleTouchStart(e: React.TouchEvent, index: number) {
    if (selectMode || q) return
    e.stopPropagation()
    touchDragRef.current = { fromIndex: index }
    setTouchDragging(index)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchDragRef.current) return
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const li = el?.closest('[data-ep-index]') as HTMLElement | null
    if (!li) return
    const targetIndex = parseInt(li.dataset.epIndex ?? '-1', 10)
    if (targetIndex === -1 || targetIndex === touchDragRef.current.fromIndex) return
    const from = touchDragRef.current.fromIndex
    setEpisodes((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(targetIndex, 0, moved)
      return next.map((ep, i) => ({ ...ep, order: i + 1 }))
    })
    touchDragRef.current.fromIndex = targetIndex
    setTouchDragging(targetIndex)
  }

  function handleTouchEnd() {
    if (!touchDragRef.current) return
    touchDragRef.current = null
    setTouchDragging(null)
    if (!user || !novelId) return
    setEpisodes((prev) => {
      prev.forEach((ep, i) => {
        updateDoc(doc(db, 'users', user!.uid, 'novels', novelId!, 'episodes', ep.id), {
          order: i + 1,
        }).catch(() => {})
      })
      return prev
    })
  }

  if (loading || !novel) {
    return <div className="flex h-screen items-center justify-center text-gray-400">로딩 중…</div>
  }

  const q = epSearch.trim().toLowerCase()
  const visible = q
    ? episodes.filter((ep) => {
        if (ep.title.toLowerCase().includes(q)) return true
        if (ep.excerpt?.toLowerCase().includes(q)) return true
        if (deepSearch && deepContents[ep.id]?.toLowerCase().includes(q)) return true
        return false
      })
    : episodes

  const getDeepSnippet = (ep: Episode): string | null => {
    if (!deepSearch || !q) return null
    if (ep.title.toLowerCase().includes(q)) return null
    if (ep.excerpt?.toLowerCase().includes(q)) return null
    const content = deepContents[ep.id]
    if (!content) return null
    const idx = content.toLowerCase().indexOf(q)
    if (idx === -1) return null
    const start = Math.max(0, idx - 30)
    const end = Math.min(content.length, idx + q.length + 60)
    return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link to="/" className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            ← <span className="hidden sm:inline">목록</span>
          </Link>
          <h1 className="flex-1 truncate text-lg font-bold text-gray-800 dark:text-gray-100">{novel.title}</h1>
          {episodes.length > 0 && (
            <button
              onClick={handleExportAll}
              disabled={!!exportProgress}
              title="전체 회차 txt로 내보내기"
              className="hidden sm:block shrink-0 text-sm text-gray-400 transition hover:text-gray-700 disabled:opacity-60 dark:hover:text-gray-200"
            >
              {exportProgress
                ? `내보내는 중… ${exportProgress.current}/${exportProgress.total}`
                : '↓ 전체 내보내기'}
            </button>
          )}
          <DarkModeToggle />
          {user && <div className="hidden sm:block"><AuthButton user={user} /></div>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6">

        {/* 작품 설명 */}
        <div className="mb-5">
          {descEditing ? (
            <textarea
              autoFocus
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => { if (e.key === 'Escape') setDescEditing(false) }}
              rows={2}
              placeholder="작품 설명을 입력하세요"
              className="w-full resize-none rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none dark:border-indigo-600 dark:bg-gray-800 dark:text-gray-200"
            />
          ) : (
            <button
              onClick={() => { setDescDraft(novel.description ?? ''); setDescEditing(true) }}
              className="group w-full text-left"
            >
              {novel.description ? (
                <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {novel.description}
                  <span className="ml-1.5 opacity-0 transition group-hover:opacity-100 text-gray-400">✎</span>
                </p>
              ) : (
                <p className="text-sm italic text-gray-300 dark:text-gray-600">설명 추가…</p>
              )}
            </button>
          )}
        </div>

        {/* 통계 */}
        {episodes.length > 0 && (() => {
          const totalChars = episodes.reduce((s, ep) => s + (ep.charCount || 0), 0)
          const avgChars = Math.round(totalChars / episodes.length)
          const pages = Math.round(totalChars / 400)
          return (
            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-gray-50 px-4 py-2.5 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-200">{episodes.length}회차</span>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span>총 <span className="font-medium text-gray-700 dark:text-gray-200">{totalChars.toLocaleString()}</span>자</span>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span>평균 <span className="font-medium text-gray-700 dark:text-gray-200">{avgChars.toLocaleString()}</span>자/회</span>
              {pages > 0 && (
                <>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <span>약 <span className="font-medium text-gray-700 dark:text-gray-200">{pages}</span>페이지</span>
                </>
              )}
            </div>
          )
        })()}

        {/* AI 리뷰 버튼 */}
        {episodes.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => { setReviewOpen(true); if (!reviewResult) handleAIReview() }}
              disabled={isAILimitReached()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-2.5 text-sm font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-40 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-900/40"
            >
              <span>✦</span> AI 소설 리뷰
            </button>
          </div>
        )}

        {/* 탭 */}
        <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 등장인물 탭 */}
        {activeTab === 'characters' && user && novelId && (
          <CharactersTab uid={user.uid} novelId={novelId} />
        )}

        {/* 세계관 탭 */}
        {activeTab === 'world' && user && novelId && (
          <WorldNotesTab uid={user.uid} novelId={novelId} />
        )}

        {/* 플롯 탭 */}
        {activeTab === 'plot' && user && novelId && (
          <PlotTab uid={user.uid} novelId={novelId} />
        )}

        {/* 회차 탭 */}
        {activeTab === 'episodes' && (<><div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-700 dark:text-gray-300">회차 목록</h2>
            {episodes.length > 1 && !selectMode && (
              <button
                onClick={handleReorderCleanup}
                title="1화부터 순서 번호 다시 매기기"
                className="text-xs text-gray-400 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400"
              >
                순서 정리
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                  >
                    {selectedIds.size}개 삭제
                  </button>
                )}
                <button
                  onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                {episodes.length > 1 && (
                  <button
                    onClick={() => setSelectMode(true)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400"
                  >
                    선택
                  </button>
                )}
                <button
                  onClick={() => setCreating(true)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  + 새 회차
                </button>
              </>
            )}
          </div>
        </div>

        {episodes.length >= 5 && (
          <div className="mb-4 flex gap-2">
            <input
              type="search"
              placeholder="회차 제목 / 내용 검색…"
              value={epSearch}
              onChange={(e) => setEpSearch(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-600"
            />
            <button
              onClick={deepSearch ? () => { setDeepSearch(false); setDeepContents({}) } : loadDeepSearch}
              disabled={deepLoading}
              title={deepSearch ? '전체 내용 검색 해제' : '전체 내용까지 검색 (Firestore 조회)'}
              className={`shrink-0 rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
                deepSearch
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {deepLoading ? '로딩…' : deepSearch ? '전체 ON' : '전체'}
            </button>
          </div>
        )}

        {creating && episodes.length > 0 && (
          <form onSubmit={handleCreateEpisode} className="mb-4 flex gap-2">
            <input
              autoFocus
              required
              placeholder="회차 제목"
              value={epTitle}
              onChange={(e) => setEpTitle(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              만들기
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-600"
            >
              취소
            </button>
          </form>
        )}

        {episodes.length === 0 ? (
          <div className="flex flex-col items-center pt-8">
            <div className="w-full max-w-sm space-y-3">
              {/* AI 마법사 */}
              <button
                onClick={() => setWizardOpen(true)}
                className="w-full rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 text-center shadow-sm transition hover:border-indigo-300 hover:shadow-md active:scale-[0.98] dark:border-indigo-800 dark:from-indigo-950/50 dark:to-violet-950/50 dark:hover:border-indigo-700"
              >
                <p className="mb-2 text-3xl">✨</p>
                <p className="font-bold text-indigo-700 dark:text-indigo-300">AI와 함께 첫 회차 쓰기</p>
                <p className="mt-1 text-xs text-indigo-400 dark:text-indigo-500">뼈대 구성 → 첫 장면 자동 생성 → 수정</p>
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400">또는 직접 시작</span>
                <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <form onSubmit={handleCreateEpisode} className="space-y-3">
                  <input
                    required
                    placeholder="예: 1화, 프롤로그…"
                    value={epTitle}
                    onChange={(e) => setEpTitle(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gray-800 py-3 text-sm font-semibold text-white hover:bg-gray-700 active:scale-[0.98] dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    빈 에디터로 시작하기
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-400 dark:text-gray-600">
            "{epSearch}"에 해당하는 회차가 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((ep, index) => (
              <li
                key={ep.id}
                data-ep-index={index}
                draggable={!selectMode}
                onDragStart={() => !selectMode && handleDragStart(index)}
                onDragOver={(e) => !selectMode && handleDragOver(e, index)}
                onDragEnd={() => !selectMode && handleDragEnd()}
                className={`group flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-4 py-3 hover:shadow-sm dark:bg-gray-800 transition-opacity ${
                  touchDragging === index ? 'opacity-40 scale-[0.98]' : ''
                } ${
                  selectMode && selectedIds.has(ep.id)
                    ? 'border-indigo-400 dark:border-indigo-600'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                onClick={
                  selectMode
                    ? () => toggleSelect(ep.id)
                    : editingEpId !== ep.id
                    ? () => navigate(`/novels/${novelId}/episodes/${ep.id}`)
                    : undefined
                }
              >
                {selectMode ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(ep.id)}
                    onChange={() => toggleSelect(ep.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 shrink-0 rounded accent-indigo-500"
                  />
                ) : (
                  <>
                    {/* 드래그 핸들 — 데스크탑: 마우스 드래그 / 모바일: 터치 드래그 */}
                    {!q && (
                      <span
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={(e) => handleTouchStart(e, index)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className="cursor-grab touch-none select-none text-gray-200 active:text-indigo-400 dark:text-gray-700"
                        style={{ touchAction: 'none' }}
                        aria-hidden="true"
                      >⠿</span>
                    )}
                  </>
                )}
                {editingEpId === ep.id ? (
                  <input
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={commitEditEp}
                    onKeyDown={onEpKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 rounded-lg border border-indigo-400 bg-transparent px-1 text-sm font-medium text-gray-700 focus:outline-none dark:text-gray-200"
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{ep.order}화</span>
                      <span className="font-medium text-gray-700 group-hover:text-indigo-600 dark:text-gray-200 dark:group-hover:text-indigo-400">{ep.title}</span>
                      <span className="text-xs text-gray-400">{ep.charCount.toLocaleString()}자</span>
                    </div>
                    {ep.excerpt && (
                      <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-600">
                        {ep.excerpt}
                      </p>
                    )}
                    {(() => {
                      const snippet = getDeepSnippet(ep)
                      return snippet ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-amber-600/80 dark:text-amber-500">
                          {snippet}
                        </p>
                      ) : null
                    })()}
                    {(() => {
                      const goal = parseInt(localStorage.getItem(`goal-${ep.id}`) ?? '0', 10)
                      if (!goal) return null
                      const pct = Math.min(Math.round((ep.charCount / goal) * 100), 100)
                      return (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-400' : 'bg-indigo-300 dark:bg-indigo-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-600">{pct}%</span>
                        </div>
                      )
                    })()}
                  </div>
                )}
                {!selectMode && editingEpId !== ep.id && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditEp(ep) }}
                      className="rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300"
                      aria-label="제목 수정"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyEpisode(ep) }}
                      className="rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-indigo-500 dark:text-gray-600 dark:hover:text-indigo-400"
                      aria-label="회차 복사"
                      title="복사"
                    >
                      ⎘
                    </button>
                  </>
                )}
                {!selectMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteEpisode(ep.id) }}
                    className="rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 dark:text-gray-600"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        </>)}
      </main>

      {wizardOpen && (
        <WritingWizard onClose={() => setWizardOpen(false)} onCreate={handleWizardCreate} />
      )}

      {reviewOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-gray-900/50" onClick={() => { reviewAbortRef.current?.abort(); setReviewOpen(false) }} />
          <div className="fixed inset-x-4 bottom-4 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:inset-x-auto sm:left-1/2 sm:w-[560px] sm:-translate-x-1/2">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 dark:text-gray-100">AI 소설 리뷰</span>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:bg-purple-900/60 dark:text-purple-300">Gemini</span>
              </div>
              <button onClick={() => { reviewAbortRef.current?.abort(); setReviewOpen(false) }} className="rounded p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {reviewing && !reviewResult && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-200 border-t-purple-500" />
                  <p className="text-sm text-gray-400">소설 분석 중…</p>
                </div>
              )}
              {reviewError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {reviewError}
                </div>
              )}
              {reviewResult && (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {reviewResult}
                  {reviewing && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-current align-middle" />}
                </div>
              )}
            </div>
            {!reviewing && !reviewResult && !reviewError && (
              <div className="shrink-0 border-t border-gray-100 p-4 dark:border-gray-700">
                <button
                  onClick={handleAIReview}
                  className="w-full rounded-xl bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
                >
                  리뷰 시작
                </button>
              </div>
            )}
            {!reviewing && (reviewResult || reviewError) && (
              <div className="shrink-0 border-t border-gray-100 p-4 dark:border-gray-700">
                <button
                  onClick={handleAIReview}
                  className="w-full rounded-xl border border-purple-200 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/40"
                >
                  다시 리뷰
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
