'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, CheckCircle2, Circle, MessageSquare, AlertCircle, Copy, Loader2, Send, Image as ImageIcon, User, X, Home, ExternalLink } from 'lucide-react'
import { formatDate, getDaysUntilDue } from '@/lib/utils'
import { useSession } from 'next-auth/react'
import ImageModal from '@/components/ImageModal'
import { useSSE } from '@/lib/sse-client'

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
  user: {
    name?: string | null
    email: string
  }
}

interface ThreadImage {
  id: string
  url: string
  filename: string
  size: number
  mimeType: string
}

interface ThreadMessage {
  id: string
  content: string
  createdAt: string
  user: {
    name?: string | null
    email: string
    image?: string | null
  }
  images: ThreadImage[]
}

export default function SharedTaskPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const shareId = params.shareId as string
  const [task, setTask] = useState<SharedTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [showThread, setShowThread] = useState(true)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalImage, setModalImage] = useState({ url: '', alt: '' })
  const [copySuccess, setCopySuccess] = useState(false)
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Store the shared URL to redirect back after login
      sessionStorage.setItem('redirectUrl', `/shared/task/${shareId}`)
      router.push('/auth/signin')
    }
  }, [status, shareId, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSharedTask()
    }
  }, [shareId, status])

  useEffect(() => {
    if (task && messages.length === 0) {
      fetchThreadMessages()
    }
  }, [task])
  
  // Register as task viewer for real-time updates
  useEffect(() => {
    if (session && task) {
      // Register this user as viewing the task
      fetch(`/api/tasks/${task.id}/view`, {
        method: 'POST',
        credentials: 'same-origin'
      }).catch(err => console.error('Failed to register task viewer:', err))
      
      // Cleanup: unregister when leaving the page
      return () => {
        fetch(`/api/tasks/${task.id}/view`, {
          method: 'DELETE',
          credentials: 'same-origin'
        }).catch(err => console.error('Failed to unregister task viewer:', err))
      }
    }
  }, [task?.id, session])

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // Handle real-time updates
  const handleSSEMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      
      // Handle shared task updates
      if (data.type === 'shared-task-updated' && data.task && data.task.id === task?.id) {
        setTask(data.task)
      }
      
      // Handle thread message updates
      if ((data.type === 'thread-message-added' || data.type === 'thread-message') && data.taskId === task?.id && showThread) {
        // Check if message already exists to avoid duplicates
        setMessages(prevMessages => {
          const exists = prevMessages.some(msg => msg.id === data.message.id)
          if (!exists) {
            return [...prevMessages, data.message]
          }
          return prevMessages
        })
      }
    } catch (error) {
      console.error('Error handling SSE message:', error)
    }
  }, [task?.id, messages, showThread])

  // Subscribe to SSE
  useSSE('/api/events', {
    onMessage: handleSSEMessage
  })

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

  const fetchThreadMessages = async () => {
    if (!task) return

    try {
      const response = await fetch(`/api/tasks/${task.id}/thread`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data)
      }
    } catch (err) {
      console.error('Failed to fetch thread messages:', err)
    }
  }

  const sendThreadMessage = async () => {
    if (!newMessage.trim() && selectedImages.length === 0) return
    if (!task) return

    setSendingMessage(true)
    try {
      const formData = new FormData()
      formData.append('content', newMessage.trim())
      
      selectedImages.forEach((image) => {
        formData.append('images', image)
      })

      const response = await fetch(`/api/tasks/${task.id}/thread`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const newMsg = await response.json()
        setMessages([...messages, newMsg])
        setNewMessage('')
        setSelectedImages([])
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to send message:', errorData)
        setError(`メッセージの送信に失敗しました: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setError('メッセージの送信に失敗しました')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        setError(`画像 "${file.name}" は5MBを超えています`)
        return false
      }
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" は画像ファイルではありません`)
        return false
      }
      return true
    })
    setSelectedImages([...selectedImages, ...validFiles])
  }

  const removeSelectedImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index))
  }

  const openImageModal = (url: string, alt: string) => {
    setModalImage({ url, alt })
    setModalOpen(true)
  }

  const copyTaskToMyList = async () => {
    if (!task || !session) return

    setCopying(true)
    try {
      console.log('Copying task with uniqueId:', task.uniqueId)
      const requestBody = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate,
        category: task.category,
        importedFromTaskId: task.id,
        importedFromUserId: task.user.email, // メールアドレスを送信し、サーバー側でユーザーIDに変換
        originalUniqueId: task.uniqueId, // 元のタスクのuniqueIdを渡す
      }
      console.log('Request body:', requestBody)
      
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'タスクのコピーに失敗しました' }))
        throw new Error(errorData.error || 'タスクのコピーに失敗しました')
      }

      const newTask = await response.json()
      setCopiedTaskId(newTask.id)
      setCopySuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'タスクのコピーに失敗しました')
    } finally {
      setCopying(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="w-12 h-12 rounded-full spinner-gradient"></div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center glass p-8 rounded-xl shadow-xl"
        >
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            タスクが見つかりません
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            {error || '共有されたタスクが存在しないか、アクセス権限がありません。'}
          </p>
        </motion.div>
      </div>
    )
  }

  const daysUntilDue = getDaysUntilDue(task.dueDate || null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl shadow-2xl overflow-hidden fade-in"
        >
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <h1 className="text-white text-xl font-bold">共有タスク</h1>
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
                  <span className={`px-3 py-1 text-sm font-medium rounded-full border transition-all ${
                    getPriorityColor(task.priority)
                  } ${
                    task.priority === 'HIGH' ? 'priority-high' :
                    task.priority === 'MEDIUM' ? 'priority-medium' : 'priority-low'
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
                  <span className="text-xs text-gray-400">
                    (ステータス変更は編集権限が必要です)
                  </span>
                </div>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="pt-4 border-t flex items-center justify-end">
              {session && (
                <>
                  {copySuccess ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">コピーしました！</span>
                      </div>
                      <button
                        onClick={() => router.push('/')}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Home className="h-4 w-4" />
                        <span>自分のタスク一覧へ</span>
                      </button>
                      <button
                        onClick={() => router.push(`/tasks/${copiedTaskId}`)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>コピーしたタスクを見る</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={copyTaskToMyList}
                      disabled={copying}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {copying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>コピー中...</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          <span>自分のタスクにコピー</span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* スレッドセクション */}
        <AnimatePresence>
          {showThread && task && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 glass rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                <h2 className="text-white text-lg font-bold">スレッド</h2>
              </div>

              <div className="p-6">
                <div className="max-h-96 overflow-y-auto space-y-4 mb-4">
                  {messages.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      まだメッセージがありません
                    </p>
                  ) : (
                    messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex space-x-3 ${
                          message.user.email === session?.user?.email ? 'flex-row-reverse space-x-reverse' : ''
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {message.user.image ? (
                            <img
                              src={message.user.image}
                              alt={message.user.name || ''}
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div className={`flex-1 max-w-xs lg:max-w-md ${
                          message.user.email === session?.user?.email ? 'text-right' : ''
                        }`}>
                          <div className="text-xs text-gray-500 mb-1">
                            {message.user.name || message.user.email} • {formatDate(message.createdAt)}
                          </div>
                          {message.content && (
                            <div className={`inline-block p-3 rounded-lg ${
                              message.user.email === session?.user?.email 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                          )}
                          {message.images.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.images.map((image) => (
                                <img
                                  key={image.id}
                                  src={image.url}
                                  alt={image.filename}
                                  className="max-w-full rounded-lg shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => openImageModal(image.url, image.filename)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* メッセージ入力欄 */}
                {session && (
                  <div className="border-t pt-4">
                    {selectedImages.length > 0 && (
                      <div className="mb-3 flex gap-2 flex-wrap">
                        {selectedImages.map((file, index) => (
                          <div key={index} className="relative">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Selected ${index + 1}`}
                              className="h-20 w-20 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => removeSelectedImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-end space-x-2">
                      <div className="flex-1">
                        <textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              sendThreadMessage()
                            }
                          }}
                          placeholder="メッセージを入力..."
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={1}
                        />
                      </div>
                      
                      <input
                        type="file"
                        id="thread-image-input"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="thread-image-input"
                        className="p-2 text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        <ImageIcon className="h-5 w-5" />
                      </label>
                      
                      <button
                        onClick={sendThreadMessage}
                        disabled={sendingMessage || (!newMessage.trim() && selectedImages.length === 0)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingMessage ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* 画像拡大モーダル */}
      <ImageModal
        isOpen={modalOpen}
        imageUrl={modalImage.url}
        imageAlt={modalImage.alt}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}