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
import type { Episode, Novel } from '@/types'

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
  const dragIndexRef = useRef<number | null>(null)

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
    const newRef = await addDoc(epRef, {
      novelId,
      title: `${ep.title} (복사본)`,
      content,
      order: episodes.length + 1,
      charCount: ep.charCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setEpisodes((prev) => [
      ...prev,
      { id: newRef.id, novelId: novelId!, title: `${ep.title} (복사본)`, content, order: prev.length + 1, charCount: ep.charCount, createdAt: new Date(), updatedAt: new Date() },
    ])
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

  async function handleMoveEpisode(id: string, dir: -1 | 1) {
    if (!user || !novelId) return
    const idx = episodes.findIndex((ep) => ep.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= episodes.length) return
    const updated = [...episodes]
    const [moved] = updated.splice(idx, 1)
    updated.splice(newIdx, 0, moved)
    const reordered = updated.map((ep, i) => ({ ...ep, order: i + 1 }))
    setEpisodes(reordered)
    await Promise.all([
      updateDoc(doc(db, 'users', user.uid, 'novels', novelId, 'episodes', id), { order: newIdx + 1 }),
      updateDoc(doc(db, 'users', user.uid, 'novels', novelId, 'episodes', episodes[newIdx].id), { order: idx + 1 }),
    ])
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

        <div className="mb-3 flex items-center justify-between">
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
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-6 text-center">
                <p className="mb-3 text-4xl">✍️</p>
                <h2 className="mb-1 text-lg font-bold text-gray-800 dark:text-gray-100">첫 회차를 시작해보세요</h2>
                <p className="text-sm text-gray-400 dark:text-gray-500">제목을 입력하고 바로 쓰기 시작하세요</p>
              </div>
              <form onSubmit={handleCreateEpisode} className="space-y-3">
                <input
                  autoFocus
                  required
                  placeholder="예: 1화, 프롤로그…"
                  value={epTitle}
                  onChange={(e) => setEpTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98]"
                >
                  만들고 시작하기
                </button>
              </form>
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
                draggable={!selectMode}
                onDragStart={() => !selectMode && handleDragStart(index)}
                onDragOver={(e) => !selectMode && handleDragOver(e, index)}
                onDragEnd={() => !selectMode && handleDragEnd()}
                className={`group flex cursor-pointer items-center gap-2 rounded-xl border bg-white px-4 py-3 hover:shadow-sm dark:bg-gray-800 ${
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
                    {/* 데스크탑: 드래그 핸들 (검색 중 숨김) */}
                    {!q && <span
                      onClick={(e) => e.stopPropagation()}
                      className="hidden sm:inline cursor-grab text-gray-200 select-none dark:text-gray-700"
                      aria-hidden="true"
                    >⠿</span>}
                    {/* 모바일: ↑↓ 순서 버튼 (검색 중 숨김) */}
                    {!q && <div className="flex sm:hidden flex-col" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleMoveEpisode(ep.id, -1)}
                        disabled={index === 0}
                        className="rounded px-1 py-0.5 text-[10px] text-gray-300 hover:text-indigo-500 disabled:opacity-20 dark:text-gray-700"
                      >▲</button>
                      <button
                        onClick={() => handleMoveEpisode(ep.id, 1)}
                        disabled={index === visible.length - 1}
                        className="rounded px-1 py-0.5 text-[10px] text-gray-300 hover:text-indigo-500 disabled:opacity-20 dark:text-gray-700"
                      >▼</button>
                    </div>}
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
      </main>
    </div>
  )
}
