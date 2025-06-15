'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Send,
  Image as ImageIcon,
  Loader2,
  User,
  Share2,
  MessageSquare
} from 'lucide-react'
import { formatDate, getDaysUntilDue } from '@/lib/utils'

interface TaskDetail {
  id: string
  title: string
  description?: string
  dueDate?: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  completed: boolean
  category?: string | null
  isShared: boolean
  shareId?: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name?: string | null
    email: string
  }
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
  images: {
    id: string
    url: string
    filename: string
  }[]
}

export default function TaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const taskId = params.id as string

  const [task, setTask] = useState<TaskDetail | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImages, setSelectedImages] = useState<File[]>([])

  useEffect(() => {
    if (session) {
      fetchTaskAndMessages()
    }
  }, [taskId, session])

  const fetchTaskAndMessages = async () => {
    try {
      setLoading(true)
      
      // タスクの詳細を取得
      const taskResponse = await fetch(`/api/tasks/${taskId}`)
      if (!taskResponse.ok) {
        throw new Error('タスクが見つかりません')
      }
      const taskData = await taskResponse.json()
      setTask(taskData)

      // スレッドメッセージを取得
      const messagesResponse = await fetch(`/api/tasks/${taskId}/thread`)
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        setMessages(messagesData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() && selectedImages.length === 0) return

    setSendingMessage(true)
    try {
      const formData = new FormData()
      formData.append('content', newMessage.trim())
      
      selectedImages.forEach((image, index) => {
        formData.append(`images`, image)
      })

      const response = await fetch(`/api/tasks/${taskId}/thread`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const newMsg = await response.json()
        setMessages([...messages, newMsg])
        setNewMessage('')
        setSelectedImages([])
      } else {
        setError('メッセージの送信に失敗しました')
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
    setSelectedImages([...selectedImages, ...files])
  }

  const removeSelectedImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index))
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
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">エラー</h1>
          <p className="text-gray-600">{error || 'タスクが見つかりません'}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  const daysUntilDue = getDaysUntilDue(task.dueDate || null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* タスク詳細 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <div className="mb-6">
              <div className="flex items-start space-x-4">
                <div className={`mt-1 ${task.completed ? 'text-green-500' : 'text-gray-400'}`}>
                  {task.completed ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Circle className="h-6 w-6" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h1 className={`text-2xl font-semibold ${
                      task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                    }`}>
                      {task.title}
                    </h1>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full border ${
                      getPriorityColor(task.priority)
                    }`}>
                      {task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'}
                    </span>
                    {task.isShared && (
                      <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
                        <Share2 className="h-3 w-3 inline mr-1" />
                        共有中
                      </span>
                    )}
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

                  <div className="space-y-2 text-sm text-gray-500">
                    {task.dueDate && (
                      <div className={`flex items-center space-x-2 ${
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
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>作成日: {formatDate(task.createdAt)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span>作成者: {task.user.name || task.user.email}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* スレッド */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg flex flex-col h-[600px]"
          >
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                スレッド
              </h2>
            </div>

            {/* メッセージリスト */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>まだメッセージがありません</p>
                </div>
              ) : (
                <AnimatePresence>
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-start space-x-3 ${
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
                        <div className={`inline-block p-3 rounded-lg ${
                          message.user.email === session?.user?.email 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        </div>
                        {message.images.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.images.map((image) => (
                              <img
                                key={image.id}
                                src={image.url}
                                alt={image.filename}
                                className="max-w-full rounded-lg shadow-sm"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* 画像プレビュー */}
            {selectedImages.length > 0 && (
              <div className="px-4 py-2 border-t bg-gray-50">
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Selected ${index + 1}`}
                        className="h-16 w-16 object-cover rounded"
                      />
                      <button
                        onClick={() => removeSelectedImage(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* メッセージ入力 */}
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="メッセージを入力..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sendingMessage}
                />
                <label className="p-2 text-gray-500 hover:text-gray-700 cursor-pointer">
                  <ImageIcon className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={sendingMessage}
                  />
                </label>
                <button
                  onClick={sendMessage}
                  disabled={sendingMessage || (!newMessage.trim() && selectedImages.length === 0)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {sendingMessage ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}