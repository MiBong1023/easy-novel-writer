import { useEffect, useRef, useState } from 'react'
import { doc, setDoc, serverTimestamp, collection, addDoc, increment, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useAutoSave(
  novelId: string,
  episodeId: string,
  content: string,
  userId: string | null,
) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevContentRef = useRef(content)
  const lastVersionTimeRef = useRef(0)

  useEffect(() => {
    if (!userId || !novelId || !episodeId) return
    if (content === prevContentRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setStatus('saving')
      try {
        const ref = doc(db, 'users', userId, 'novels', novelId, 'episodes', episodeId)
        const delta = content.length - prevContentRef.current.length
        await setDoc(ref, { content, updatedAt: serverTimestamp(), charCount: content.length }, { merge: true })

        // 오늘 작성량 기록 (증가분만)
        if (delta > 0) {
          const today = new Date().toISOString().slice(0, 10)
          const statsRef = doc(db, 'users', userId, 'stats', today)
          updateDoc(statsRef, { charsAdded: increment(delta) }).catch(() =>
            setDoc(statsRef, { charsAdded: delta, date: today })
          )
        }

        prevContentRef.current = content
        setStatus('saved')

        // 5분마다 버전 스냅샷 저장
        const now = Date.now()
        if (now - lastVersionTimeRef.current >= 5 * 60 * 1000) {
          lastVersionTimeRef.current = now
          const versionsRef = collection(db, 'users', userId, 'novels', novelId, 'episodes', episodeId, 'versions')
          addDoc(versionsRef, { content, charCount: content.length, savedAt: serverTimestamp() }).catch(() => {})
        }
      } catch {
        setStatus('error')
      }
    }, 1500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [content, userId, novelId, episodeId])

  return status
}
