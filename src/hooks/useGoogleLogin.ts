import { useState } from 'react'
import { auth, googleProvider, linkWithPopup, signInWithPopup } from '@/lib/firebase'

export function useGoogleLogin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loginWithGoogle() {
    setLoading(true)
    setError('')
    const currentUser = auth.currentUser

    try {
      if (currentUser?.isAnonymous) {
        // 익명 계정을 Google 계정으로 업그레이드 — UID 유지, 데이터 보존
        await linkWithPopup(currentUser, googleProvider)
      } else {
        await signInWithPopup(auth, googleProvider)
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''

      if (code === 'auth/credential-already-in-use') {
        // 이미 다른 기기에서 Google 로그인한 계정 → 그냥 로그인
        // (익명 데이터는 새 UID로 이전되지 않음)
        try {
          await signInWithPopup(auth, googleProvider)
        } catch (inner) {
          setError('Google 로그인에 실패했습니다.')
          console.error(inner)
        }
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('Google 로그인에 실패했습니다.')
        console.error(err)
      }
    } finally {
      setLoading(false)
    }
  }

  return { loginWithGoogle, loading, error }
}
