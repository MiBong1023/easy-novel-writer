import { useEffect, useState } from 'react'
import { auth, signInAnonymously, onAuthStateChanged, type User } from '@/lib/firebase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u)
      } else {
        const { user: anon } = await signInAnonymously(auth)
        setUser(anon)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return { user, loading }
}
