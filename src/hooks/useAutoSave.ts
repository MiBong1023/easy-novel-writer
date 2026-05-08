import { useCallback, useEffect, useRef, useState } from 'react'
import { doc, setDoc, serverTimestamp, collection, addDoc, increment, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { callGemini, msg } from '@/lib/gemini'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useAutoSave(
  novelId: string,
  episodeId: string,
  content: string,
  userId: string | null,
  hasSummary = false,
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevContentRef = useRef(content)
  const lastVersionTimeRef = useRef(0)
  const latestContentRef = useRef(content)
  const summaryDoneRef = useRef(hasSummary)
  latestContentRef.current = content

  const performSave = useCallback(async (currentContent: string) => {
    if (!userId || !novelId || !episodeId) return
    if (currentContent === prevContentRef.current) { setStatus('saved'); return }

    setStatus('saving')
    try {
      const ref = doc(db, 'users', userId, 'novels', novelId, 'episodes', episodeId)
      const delta = currentContent.length - prevContentRef.current.length
      await setDoc(ref, { content: currentContent, updatedAt: serverTimestamp(), charCount: currentContent.length, excerpt: currentContent.slice(0, 80) }, { merge: true })

      if (delta > 0) {
        const today = new Date().toISOString().slice(0, 10)
        const statsRef = doc(db, 'users', userId, 'stats', today)
        updateDoc(statsRef, { charsAdded: increment(delta) }).catch(() =>
          setDoc(statsRef, { charsAdded: delta, date: today })
        )
      }

      if (delta !== 0) {
        const novelRef = doc(db, 'users', userId, 'novels', novelId)
        updateDoc(novelRef, { totalChars: increment(delta) }).catch(() => {})
      }

      prevContentRef.current = currentContent
      setHasUnsaved(false)
      setStatus('saved')

      // 자동 요약: 첫 저장 시 300자 이상이면 백그라운드 생성 (회차당 1회)
      if (!summaryDoneRef.current && currentContent.length >= 300) {
        summaryDoneRef.current = true
        callGemini(
          [msg('user', currentContent.slice(0, 2000))],
          '당신은 한국어 소설 편집자입니다. 주어진 소설 회차의 핵심 내용을 60자 이내 한 문장으로 요약하세요. 요약 텍스트만 출력하세요.',
        ).then((summary) => {
          if (summary && userId && novelId && episodeId) {
            updateDoc(doc(db, 'users', userId, 'novels', novelId, 'episodes', episodeId), { summary }).catch(() => {})
          }
        }).catch(() => { summaryDoneRef.current = false })
      }

      const now = Date.now()
      if (now - lastVersionTimeRef.current >= 5 * 60 * 1000) {
        lastVersionTimeRef.current = now
        const versionsRef = collection(db, 'users', userId, 'novels', novelId, 'episodes', episodeId, 'versions')
        addDoc(versionsRef, { content: currentContent, charCount: currentContent.length, savedAt: serverTimestamp() }).catch(() => {})
      }
    } catch {
      setStatus('error')
    }
  }, [userId, novelId, episodeId])

  useEffect(() => {
    if (!userId || !novelId || !episodeId) return
    if (content === prevContentRef.current) return

    setHasUnsaved(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => performSave(content), 1500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [content, userId, novelId, episodeId, performSave])

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!hasUnsaved) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])

  function saveNow() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    performSave(latestContentRef.current)
  }

  return { status, saveNow }
}
