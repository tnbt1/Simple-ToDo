'use client'

import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SignOut() {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/auth/signin')
  }
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">👋</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              ログアウトしますか？
            </h1>
            <p className="text-gray-600">
              現在ログイン中です
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              ログアウト
            </button>
            
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              キャンセル
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              ログアウト後は再度ログインが必要になります
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}