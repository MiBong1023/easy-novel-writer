import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, serverTimestamp, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import Editor from '@/components/Editor'
import NotesPanel from '@/components/NotesPanel'
import AuthButton from '@/components/AuthButton'
import DarkModeToggle from '@/components/DarkModeToggle'
import { useDarkMode } from '@/hooks/useDarkMode'
import ShortcutsModal from '@/components/ShortcutsModal'
import PreviewModal from '@/components/PreviewModal'
import type { Episode } from '@/types'

export default function EditorPage() {
  const { novelId, episodeId } = useParams<{ novelId: string; episodeId: string }>()
  const { user, loading } = useAuth()
  const { dark, toggle: toggleDark } = useDarkMode()
  const navigate = useNavigate()
  const [episode, setEpisode] = useState<Episode | null>(null)
  const [novelTitle, setNovelTitle] = useState('')
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [siblings, setSiblings] = useState<{ id: string; order: number }[]>([])
  const [fetching, setFetching] = useState(true)
  const [notesOpen, setNotesOpen] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [liveCharCount, setLiveCharCount] = useState(0)
  const contentRef = useRef('')

  useEffect(() => {
    if (!loading && !user) { navigate('/'); return }
  }, [loading, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !novelId || !episodeId) return
    setFetching(true)
    const epRef = doc(db, 'users', user.uid, 'novels', novelId, 'episodes', episodeId)
    const novelRef = doc(db, 'users', user.uid, 'novels', novelId)
    const listRef = collection(db, 'users', user.uid, 'novels', novelId, 'episodes')
    Promise.all([
      getDoc(epRef),
      getDoc(novelRef),
      getDocs(query(listRef, orderBy('order', 'asc'))),
    ]).then(([snap, novelSnap, listSnap]) => {
      if (snap.exists()) {
        const data = snap.data()
        const ep: Episode = {
          id: snap.id,
          ...(data as Omit<Episode, 'id'>),
          createdAt: data.createdAt?.toDate() ?? new Date(),
          updatedAt: data.updatedAt?.toDate() ?? new Date(),
        }
        setEpisode(ep)
        contentRef.current = ep.content
        setLiveCharCount(ep.content.length)
      }
      if (novelSnap.exists()) {
        setNovelTitle(novelSnap.data().title ?? '')
      }
      setSiblings(listSnap.docs.map((d) => ({ id: d.id, order: d.data().order ?? 0 })))
      setFetching(false)
    })
  }, [user, novelId, episodeId])

  // Esc로 집중 모드 해제
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  // 브라우저 탭 제목 업데이트
  useEffect(() => {
    if (!episode) return
    document.title = novelTitle ? `${episode.title} — ${novelTitle}` : episode.title
    return () => { document.title = '쉬운 소설 작가' }
  }, [episode, novelTitle])

  // 마지막 작성 회차 정보를 novel 문서에 기록
  useEffect(() => {
    if (!episode || !user || !novelId) return
    updateDoc(doc(db, 'users', user.uid, 'novels', novelId), {
      lastEpisodeTitle: episode.title,
      lastEpisodeId: episodeId,
    }).catch(() => {})
  }, [episode?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function commitTitle() {
    setTitleEditing(false)
    const trimmed = titleDraft.trim()
    if (!trimmed || !episode || trimmed === episode.title || !user || !novelId || !episodeId) return
    await updateDoc(doc(db, 'users', user.uid, 'novels', novelId, 'episodes', episodeId), {
      title: trimmed,
      updatedAt: serverTimestamp(),
    })
    setEpisode((prev) => prev ? { ...prev, title: trimmed } : prev)
    document.title = novelTitle ? `${trimmed} — ${novelTitle}` : trimmed
  }

  // Cmd+P → 미리보기, Cmd+Shift+F → 집중 모드
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setPreviewOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setFocusMode((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleExport() {
    if (!episode) return
    const blob = new Blob([contentRef.current], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${episode.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportPdf() {
    if (!episode) return
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const body = contentRef.current.split('\n')
      .map((l) => l.trim() === '' ? '<div class="gap"></div>' : `<p>${esc(l)}</p>`)
      .join('\n')
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${esc(episode.title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;color:#1a1a1a;line-height:2.1;font-size:15px}
  .wrap{max-width:580px;margin:0 auto;padding:60px 40px}
  h1{font-size:20px;font-weight:bold;text-align:center;margin-bottom:60px}
  p{text-indent:1em}
  .gap{height:1em}
  @media print{@page{margin:20mm 25mm;size:A4}.wrap{padding:0;max-width:100%}}
</style></head><body><div class="wrap"><h1>${esc(episode.title)}</h1>
${body}</div><script>window.onload=function(){setTimeout(window.print,200)}</script></body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  function handleExportMd() {
    if (!episode) return
    const md = `# ${episode.title}\n\n${contentRef.current}`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${episode.title}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleShare(expiryDays: number | null) {
    if (!episode || !user) return
    setSharing(true)
    setShareMenuOpen(false)
    try {
      const data: Record<string, unknown> = {
        novelTitle,
        episodeTitle: episode.title,
        content: contentRef.current,
        createdAt: serverTimestamp(),
      }
      if (expiryDays !== null) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + expiryDays)
        data.expiresAt = expiresAt
      }
      const ref = await addDoc(collection(db, 'shares'), data)
      const shareUrl = `${window.location.origin}/share/${ref.id}`
      await navigator.clipboard.writeText(shareUrl).catch(() => {})
      setShareToast(true)
      setTimeout(() => setShareToast(false), 3000)
    } finally {
      setSharing(false)
    }
  }

  if (loading || fetching) {
    return (
      <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
        {/* 헤더 스켈레톤 */}
        <div className="flex shrink-0 animate-pulse items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="h-4 w-10 rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 flex-1 max-w-xs rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        {/* 진행바 스켈레톤 */}
        <div className="flex animate-pulse flex-col gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="h-3 w-52 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="h-1 w-full rounded bg-gray-100 dark:bg-gray-800" />
        </div>
        {/* 본문 스켈레톤 */}
        <div className="flex-1 animate-pulse space-y-3 p-10 md:px-16">
          {[100, 95, 88, 100, 70, 100, 92, 60].map((w, i) => (
            <div key={i} className={`h-4 rounded bg-gray-100 dark:bg-gray-800`} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!episode || !user || !novelId || !episodeId) {
    return <div className="flex h-screen items-center justify-center text-gray-400">회차를 찾을 수 없어요.</div>
  }

  const currentIdx = siblings.findIndex((s) => s.id === episodeId)
  const prevEp = currentIdx > 0 ? siblings[currentIdx - 1] : null
  const nextEp = currentIdx >= 0 && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      {/* 헤더: 집중 모드일 때 숨김 */}
      {!focusMode && (
        <header className="relative flex shrink-0 items-center gap-1 border-b border-gray-200 px-3 py-3 dark:border-gray-800 sm:gap-2 sm:px-4">
          <Link
            to={`/novels/${novelId}`}
            className="shrink-0 text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            ← <span className="hidden sm:inline">목록</span>
          </Link>
          {titleEditing ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
                if (e.key === 'Escape') setTitleEditing(false)
              }}
              className="flex-1 rounded border border-indigo-400 bg-transparent px-1.5 py-0.5 text-sm font-medium text-gray-700 focus:outline-none dark:text-gray-200"
            />
          ) : (
            <span
              onClick={() => { setTitleDraft(episode.title); setTitleEditing(true) }}
              title="클릭하여 제목 수정"
              className="flex-1 cursor-text truncate text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
            >
              {episode.title}
            </span>
          )}
          {prevEp && (
            <button
              onClick={() => navigate(`/novels/${novelId}/episodes/${prevEp.id}`)}
              title="이전 회차"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              ‹
            </button>
          )}
          {nextEp && (
            <button
              onClick={() => navigate(`/novels/${novelId}/episodes/${nextEp.id}`)}
              title="다음 회차"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              ›
            </button>
          )}
          <button
            onClick={() => setNotesOpen((v) => !v)}
            title="작품 메모"
            className={`rounded-lg p-2 text-sm transition hover:bg-gray-100 dark:hover:bg-gray-800 ${notesOpen ? 'text-indigo-500' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
          >
            🗒️
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            title="미리보기"
            className="hidden sm:block rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            onClick={handleExport}
            title="txt로 내보내기"
            className="hidden sm:block rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ↓ txt
          </button>
          <button
            onClick={handleExportMd}
            title="Markdown으로 내보내기"
            className="hidden sm:block rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ↓ md
          </button>
          <button
            onClick={handleExportPdf}
            title="PDF로 내보내기 (인쇄 대화상자)"
            className="hidden sm:block rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ↓ pdf
          </button>
          {/* 공유 링크 — 만료 옵션 팝오버 */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShareMenuOpen((v) => !v)}
              disabled={sharing}
              title="공유 링크 복사"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
            {shareMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShareMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <p className="px-3 py-2 text-[10px] text-gray-400 dark:text-gray-500">링크 유효 기간</p>
                  {[{ label: '24시간', days: 1 }, { label: '7일', days: 7 }, { label: '영구', days: null }].map(({ label, days }) => (
                    <button
                      key={label}
                      onClick={() => handleShare(days)}
                      className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShortcutsOpen(true)}
            title="단축키 도움말"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ?
          </button>
          <div className="hidden sm:block"><DarkModeToggle /></div>
          <div className="hidden sm:block"><AuthButton user={user} /></div>

          {/* 모바일 전용 ⋯ 메뉴 */}
          <button
            onClick={() => setHeaderMenuOpen((v) => !v)}
            className="sm:hidden rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ⋯
          </button>
          {headerMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setHeaderMenuOpen(false)} />
              <div className="absolute right-3 top-12 z-20 min-w-[160px] rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={() => { setPreviewOpen(true); setHeaderMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 rounded-t-xl"
                >
                  미리보기
                </button>
                <button
                  onClick={() => { handleExport(); setHeaderMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  txt 내보내기
                </button>
                <button
                  onClick={() => { handleExportMd(); setHeaderMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Markdown 내보내기
                </button>
                <button
                  onClick={() => { handleExportPdf(); setHeaderMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  PDF 내보내기
                </button>
                <button
                  onClick={() => { handleShare(7); setHeaderMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  공유 링크 복사 (7일)
                </button>
                <div className="border-t border-gray-100 dark:border-gray-700" />
                <button
                  onClick={() => { toggleDark(); setHeaderMenuOpen(false) }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 rounded-b-xl"
                >
                  {dark ? '라이트 모드' : '다크 모드'}
                </button>
              </div>
            </>
          )}
        </header>
      )}

      <div className="relative flex-1 overflow-hidden">
        <Editor
          novelId={novelId}
          episodeId={episodeId}
          initialContent={episode.content}
          userId={user.uid}
          onContentChange={(v) => { contentRef.current = v; setLiveCharCount(v.length) }}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode(true)}
        />
        {!focusMode && notesOpen && (
          <NotesPanel
            novelId={novelId}
            userId={user.uid}
            onClose={() => setNotesOpen(false)}
          />
        )}

        {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
        {previewOpen && (
          <PreviewModal
            title={episode.title}
            content={contentRef.current}
            onClose={() => setPreviewOpen(false)}
          />
        )}

        {/* 공유 링크 복사 토스트 */}
        {shareToast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-800 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-gray-700">
            링크가 클립보드에 복사됐어요 🔗
          </div>
        )}

        {/* 집중 모드 하단 오버레이 */}
        {focusMode && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/25 px-5 py-2 text-sm text-white/60 backdrop-blur-sm transition-opacity duration-300 hover:bg-black/40 hover:text-white/90">
            <span className="tabular-nums">{liveCharCount.toLocaleString()}자</span>
            <span className="text-white/25">·</span>
            <button
              onClick={() => setFocusMode(false)}
              className="text-xs hover:text-white"
            >
              Esc 나가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
