'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, CheckCircle2, Circle, AlertCircle, Copy, Loader2, Home, ArrowLeft } from 'lucide-react'
import { formatDate, getDaysUntilDue } from '@/lib/utils'
import Link from 'next/link'
import { useSSE } from '@/lib/sse-client'
import { useSmartPolling } from '@/hooks/useSmartPolling'

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
  uniqueId: string
  _count?: {
    threadMessages: number
  }
}

interface CategoryInfo {
  category: string
  owner: {
    name?: string | null
    email: string
  }
  ownerId: string
  tasks: SharedTask[]
}

export default function SharedCategoryPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const shareId = params.shareId as string
  const [categoryInfo, setCategoryInfo] = useState<CategoryInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      sessionStorage.setItem('redirectUrl', `/shared/category/${shareId}`)
      router.push('/auth/signin')
    }
  }, [status, shareId, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSharedCategory()
      
      // Register as viewing this shared category
      const registerViewer = async () => {
        try {
          const response = await fetch(`/api/shared/category/${shareId}/view`, {
            method: 'POST'
          })
          if (!response.ok) {
            throw new Error(`Failed to register: ${response.statusText}`)
          }
          console.log('[SharedCategory] Successfully registered as viewer for shareId:', shareId)
        } catch (error) {
          console.error('[SharedCategory] Failed to register as viewer:', error)
          // Retry after 2 seconds
          setTimeout(registerViewer, 2000)
        }
      }
      
      registerViewer()
      
      // Cleanup: unregister when leaving
      return () => {
        fetch(`/api/shared/category/${shareId}/view`, {
          method: 'DELETE'
        }).catch(() => {}) // Ignore errors on cleanup
      }
    }
  }, [shareId, status])

  const fetchSharedCategory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/shared/category/${shareId}`)
      
      if (!response.ok) {
        throw new Error('カテゴリーが見つかりません')
      }

      const data = await response.json()
      setCategoryInfo(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const importCategory = async () => {
    if (!categoryInfo || !session) return

    setImporting(true)
    try {
      const response = await fetch('/api/categories/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareId,
          newCategoryName: categoryInfo.category
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // サーバーからのエラーメッセージを使用
        throw new Error(data.error || 'インポートに失敗しました')
      }

      // 成功レスポンスを確認
      if (data.success) {
        setImportSuccess(true)
        console.log(`インポート成功: ${data.importedCount}個のタスクをインポートしました`)
      } else {
        throw new Error('インポート処理が完了しませんでした')
      }
    } catch (err) {
      console.error('Import error:', err)
      setError(err instanceof Error ? err.message : 'インポートに失敗しました')
    } finally {
      setImporting(false)
    }
  }

  // Handle real-time updates
  const handleSSEMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      console.log('[SharedCategory] Received SSE event:', data.type, 'shareId in event:', data.shareId, 'current shareId:', shareId)
      
      // Log all events for debugging
      if (data.type && data.type.includes('category')) {
        console.log('[SharedCategory] Category-related event details:', JSON.stringify(data))
      }
      
      if (data.type === 'category-task-added' && data.shareId === shareId) {
        console.log('[SharedCategory] Processing category-task-added for this shareId:', data)
        setCategoryInfo(prev => {
          if (!prev) return prev
          // Check if task already exists to prevent duplicates
          const taskExists = prev.tasks.some(task => task.id === data.task.id)
          if (taskExists) {
            console.log('[SharedCategory] Task already exists, skipping:', data.task.id)
            return prev
          }
          console.log('[SharedCategory] Adding new task:', data.task.id, data.task.title)
          return {
            ...prev,
            tasks: [...prev.tasks, data.task]
          }
        })
      }
      
      if (data.type === 'category-task-updated' && data.shareId === shareId) {
        setCategoryInfo(prev => {
          if (!prev) return prev
          return {
            ...prev,
            tasks: prev.tasks.map(task => 
              task.id === data.task.id ? data.task : task
            )
          }
        })
      }
      
      if (data.type === 'category-task-deleted' && data.shareId === shareId) {
        setCategoryInfo(prev => {
          if (!prev) return prev
          return {
            ...prev,
            tasks: prev.tasks.filter(task => task.id !== data.taskId)
          }
        })
      }
      
      // Also handle when tasks are added to the category (without shareId)
      if (data.type === 'task-created' && categoryInfo && data.task.category === categoryInfo.category) {
        console.log('[SharedCategory] Task created in this category:', data.task)
        setCategoryInfo(prev => {
          if (!prev) return prev
          // Check if this task belongs to the category owner
          const isOwnerTask = data.task.userId === prev.ownerId
          if (!isOwnerTask) {
            console.log('[SharedCategory] Task is not from the category owner, skipping')
            return prev
          }
          // Check if task already exists
          const taskExists = prev.tasks.some(task => task.id === data.task.id)
          if (taskExists) {
            console.log('[SharedCategory] Task already exists, skipping:', data.task.id)
            return prev
          }
          return {
            ...prev,
            tasks: [...prev.tasks, data.task]
          }
        })
      }
    } catch (error) {
      console.error('Error handling SSE message:', error)
    }
  }, [shareId, categoryInfo])

  // Subscribe to SSE
  const [sseConnected, setSseConnected] = useState(false)
  const { connectionState } = useSSE((session?.user as any)?.id ? '/api/events' : '', {
    onMessage: handleSSEMessage,
    onOpen: () => setSseConnected(true),
    onError: () => setSseConnected(false)
  })
  
  // Smart polling for shared category updates
  const handleSmartPollingUpdate = useCallback((data: { tasks: SharedTask[] }) => {
    console.log('[SharedCategory SmartPolling] Received update with', data.tasks.length, 'tasks')
    
    setCategoryInfo(prev => {
      if (!prev) return prev
      
      // Update tasks from polling response
      const updatedTasks = data.tasks.filter(task => task.category === prev.category)
      
      return {
        ...prev,
        tasks: updatedTasks
      }
    })
  }, [])
  
  useSmartPolling({
    enabled: !!(session?.user as any)?.id && !sseConnected && !!categoryInfo,
    interval: 5000,
    onUpdate: handleSmartPollingUpdate,
    taskIds: categoryInfo?.tasks.map(t => t.id) || [],
    categories: categoryInfo ? [categoryInfo.category] : []
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-50 text-red-700 border-red-200'
      case 'MEDIUM': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'LOW': return 'bg-green-50 text-green-700 border-green-200'
      default: return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="w-12 h-12 rounded-full spinner-gradient"></div>
      </div>
    )
  }

  if (error || !categoryInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center glass p-8 rounded-xl shadow-xl"
        >
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            カテゴリーが見つかりません
          </h1>
          <p className="text-gray-600">
            {error || '共有されたカテゴリーが存在しないか、アクセス権限がありません。'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ホームに戻る
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>戻る</span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl shadow-2xl overflow-hidden fade-in"
        >
          {/* カテゴリー情報 */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <h1 className="text-white text-xl font-bold">
              📁 {categoryInfo.category}
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {categoryInfo.owner.name || categoryInfo.owner.email} さんが共有
            </p>
          </div>

          {/* アクションボタン */}
          <div className="p-6 border-b">
            {importSuccess ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">インポートしました！</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => router.push('/')}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Home className="h-4 w-4" />
                    <span>自分のタスク一覧へ</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-gray-600">
                  このカテゴリーには {categoryInfo.tasks.length} 件のタスクがあります
                </p>
                <button
                  onClick={importCategory}
                  disabled={importing}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>インポート中...</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>このカテゴリーをインポート</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* タスクリスト */}
          <div className="p-6 space-y-4">
            {categoryInfo.tasks.map((task, index) => {
              const daysUntilDue = getDaysUntilDue(task.dueDate || null)
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg border bg-white/50 backdrop-blur-sm"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`mt-1 ${task.completed ? 'text-green-500' : 'text-gray-400'}`}>
                      {task.completed ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold ${
                          task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                        }`}>
                          {task.title}
                        </h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                          getPriorityColor(task.priority)
                        }`}>
                          {task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {task.status === 'COMPLETED' ? '完了' :
                           task.status === 'IN_PROGRESS' ? '進行中' : '未着手'}
                        </span>
                      </div>
                      
                      {task.description && (
                        <p className={`text-sm mb-2 ${
                          task.completed ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {task.dueDate && (
                          <div className={`flex items-center space-x-1 ${
                            daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-500' :
                            daysUntilDue !== null && daysUntilDue <= 3 ? 'text-orange-500' : ''
                          }`}>
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDate(task.dueDate)}
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
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(task.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}