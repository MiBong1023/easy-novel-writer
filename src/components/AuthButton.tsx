import { useState } from 'react'
import { signOut, auth } from '@/lib/firebase'
import { useGoogleLogin } from '@/hooks/useGoogleLogin'
import type { User } from '@/lib/firebase'

interface Props {
  user: User
}

export default function AuthButton({ user }: Props) {
  const { loginWithGoogle, loading } = useGoogleLogin()
  const [menuOpen, setMenuOpen] = useState(false)

  if (user.isAnonymous) {
    return (
      <button
        onClick={loginWithGoogle}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <GoogleIcon />
        {loading ? '로그인 중…' : 'Google로 계속하기'}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full focus:outline-none"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="프로필" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
            {user.displayName?.[0] ?? 'G'}
          </div>
        )}
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <p className="truncate px-4 py-2 text-xs text-gray-400 dark:text-gray-500">
              {user.displayName ?? user.email}
            </p>
            <hr className="border-gray-100 dark:border-gray-700" />
            <button
              onClick={() => signOut(auth)}
              className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              로그아웃
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
