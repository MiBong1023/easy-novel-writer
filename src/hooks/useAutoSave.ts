import { useEffect, useRef, useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
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

  useEffect(() => {
    if (!userId || !novelId || !episodeId) return
    if (content === prevContentRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setStatus('saving')
      try {
        const ref = doc(db, 'users', userId, 'novels', novelId, 'episodes', episodeId)
        await setDoc(ref, { content, updatedAt: serverTimestamp(), charCount: content.length }, { merge: true })
        prevContentRef.current = content
        setStatus('saved')
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
