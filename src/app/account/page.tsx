'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  User, 
  Mail, 
  Calendar, 
  Shield, 
  Share2, 
  Settings,
  Save,
  ArrowLeft,
  Camera,
  Loader2
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface UserProfile {
  id: string
  name?: string | null
  email: string
  image?: string | null
  createdAt: string
  _count: {
    tasks: number
    sharedTasks: number
  }
}

export default function AccountPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // 編集フォーム
  const [name, setName] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      fetchProfile()
    } else if (session === null) {
      router.push('/auth/signin')
    }
  }, [session, router])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/account/profile')
      if (!response.ok) {
        throw new Error('プロフィールの取得に失敗しました')
      }
      const data = await response.json()
      setProfile(data)
      setName(data.name || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('name', name)
      if (imageFile) {
        formData.append('image', imageFile)
      }

      const response = await fetch('/api/account/profile', {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('プロフィールの更新に失敗しました')
      }

      const updatedProfile = await response.json()
      setProfile(updatedProfile)
      setSuccess('プロフィールを更新しました')
      
      // セッションを更新
      await update({
        ...session,
        user: {
          ...session?.user,
          name: updatedProfile.name,
          image: updatedProfile.image
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>ホームに戻る</span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          {/* タイトルバー */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h1 className="text-white text-xl font-semibold flex items-center">
              <Settings className="h-6 w-6 mr-2" />
              アカウント設定
            </h1>
          </div>

          <div className="p-6 space-y-8">
            {/* プロフィール編集 */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                プロフィール
              </h2>
              
              <div className="space-y-4">
                {/* アバター */}
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    {imagePreview || profile.image ? (
                      <img
                        src={imagePreview || profile.image || ''}
                        alt="Profile"
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-gray-300 flex items-center justify-center">
                        <User className="h-10 w-10 text-gray-600" />
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-1 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">プロフィール画像</p>
                    <p className="text-xs text-gray-400">JPG、PNG、GIF（最大5MB）</p>
                  </div>
                </div>

                {/* 名前 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名前
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="名前を入力"
                  />
                </div>

                {/* メールアドレス（読み取り専用） */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="h-4 w-4 inline mr-1" />
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>

                {/* 保存ボタン */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>保存</span>
                    </>
                  )}
                </button>

                {/* メッセージ表示 */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                    {success}
                  </div>
                )}
              </div>
            </div>

            {/* アカウント情報 */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                アカウント情報
              </h2>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">アカウント作成日</span>
                  <span className="text-sm font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(profile.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">作成したタスク数</span>
                  <span className="text-sm font-medium">{profile._count.tasks} 個</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">共有中のタスク数</span>
                  <span className="text-sm font-medium flex items-center">
                    <Share2 className="h-4 w-4 mr-1" />
                    {profile._count.sharedTasks} 個
                  </span>
                </div>
              </div>
            </div>

            {/* 危険な操作 */}
            <div>
              <h2 className="text-lg font-semibold mb-4 text-red-600">危険な操作</h2>
              <div className="border border-red-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-4">
                  アカウントを削除すると、すべてのデータが永久に削除されます。この操作は取り消せません。
                </p>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  onClick={() => {
                    if (confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) {
                      // アカウント削除処理（実装予定）
                      alert('アカウント削除機能は現在実装中です')
                    }
                  }}
                >
                  アカウントを削除
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}