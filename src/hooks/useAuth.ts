import { useEffect, useState } from 'react'
import { auth, signInAnonymously, onAuthStateChanged, type User } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        console.log('Auth OK — uid:', u.uid, 'isAnon:', u.isAnonymous)
        setUser(u)
        setLoading(false)
      } else {
        try {
          const { user: anon } = await signInAnonymously(auth)
          setUser(anon)
        } catch (err) {
          const code = (err as { code?: string }).code ?? 'unknown'
          console.error('익명 로그인 실패:', err)
          setAuthError(`익명 로그인 실패 [${code}]`)
        }
        setLoading(false)
      }
    })
    return unsub
  }, [])

  return { user, loading, authError }
}
