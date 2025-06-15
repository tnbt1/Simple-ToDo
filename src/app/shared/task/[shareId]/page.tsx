'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Calendar, Clock, CheckCircle2, Circle, MessageSquare, AlertCircle } from 'lucide-react'
import { formatDate, getDaysUntilDue } from '@/lib/utils'

interface SharedTask {
  id: string
  title: string
  description?: string
  dueDate?: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  completed: boolean
  category?: string | null
  createdAt: string
  updatedAt: string
  user: {
    name?: string | null
    email: string
  }
}

export default function SharedTaskPage() {
  const params = useParams()
  const shareId = params.shareId as string
  const [task, setTask] = useState<SharedTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSharedTask()
  }, [shareId])

  const fetchSharedTask = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/shared/task/${shareId}`)
      
      if (!response.ok) {
        throw new Error('タスクが見つかりません')
      }

      const data = await response.json()
      setTask(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-50 text-red-700 border-red-200'
      case 'MEDIUM': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'LOW': return 'bg-green-50 text-green-700 border-green-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            タスクが見つかりません
          </h1>
          <p className="text-gray-600">
            {error || '共有されたタスクが存在しないか、アクセス権限がありません。'}
          </p>
        </div>
      </div>
    )
  }

  const daysUntilDue = getDaysUntilDue(task.dueDate || null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <h1 className="text-white text-xl font-semibold">共有タスク</h1>
            <p className="text-blue-100 text-sm mt-1">
              {task.user.name || task.user.email} さんが共有
            </p>
          </div>

          {/* タスク詳細 */}
          <div className="p-6 space-y-6">
            <div className="flex items-start space-x-4">
              <div className={`mt-1 ${task.completed ? 'text-green-500' : 'text-gray-400'}`}>
                {task.completed ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <Circle className="h-6 w-6" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h2 className={`text-2xl font-semibold ${
                    task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}>
                    {task.title}
                  </h2>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border ${
                    getPriorityColor(task.priority)
                  }`}>
                    {task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'}
                  </span>
                </div>

                {task.description && (
                  <p className={`text-lg mb-4 ${
                    task.completed ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {task.description}
                  </p>
                )}

                {task.category && (
                  <div className="mb-4">
                    <span className="px-3 py-1 text-sm font-medium rounded-md bg-blue-50 text-blue-700">
                      📁 {task.category}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  {task.dueDate && (
                    <div className={`flex items-center space-x-1 ${
                      daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-500' :
                      daysUntilDue !== null && daysUntilDue <= 3 ? 'text-orange-500' : ''
                    }`}>
                      <Calendar className="h-4 w-4" />
                      <span>
                        期限: {formatDate(task.dueDate)}
                        {daysUntilDue !== null && (
                          <span className="ml-1">
                            ({daysUntilDue === 0 ? '今日' :
                              daysUntilDue > 0 ? `${daysUntilDue}日後` : `${Math.abs(daysUntilDue)}日過ぎ`})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>作成日: {formatDate(task.createdAt)}</span>
                  </div>
                </div>

                {/* ステータス表示 */}
                <div className="mt-4 flex items-center space-x-2">
                  <span className="text-sm text-gray-500">ステータス:</span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-md ${
                    task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {task.status === 'COMPLETED' ? '完了' :
                     task.status === 'IN_PROGRESS' ? '進行中' : '未着手'}
                  </span>
                </div>
              </div>
            </div>

            {/* スレッドへのリンク（後で実装） */}
            <div className="pt-4 border-t">
              <button className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium">
                <MessageSquare className="h-5 w-5" />
                <span>スレッドを表示（実装予定）</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}