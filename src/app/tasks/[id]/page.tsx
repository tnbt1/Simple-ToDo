'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  MessageSquare,
  X,
  Edit2,
  Save,
  XCircle
} from 'lucide-react'
import { formatDate, getDaysUntilDue } from '@/lib/utils'
import ImageModal from '@/components/ImageModal'
import { useSSE } from '@/lib/sse-client'

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
  importedFromTaskId?: string | null
  importedFromUser?: {
    name?: string | null
    email: string
  } | null
  sharedWith?: Array<{
    sharedWithId: string
    sharedBy: {
      name?: string | null
      email: string
    }
  }>
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [task, setTask] = useState<TaskDetail | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalImage, setModalImage] = useState({ url: '', alt: '' })
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH'
  })
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (session) {
      fetchTaskAndMessages()
    }
  }, [taskId, session])

  useEffect(() => {
    if (task && isEditing) {
      setEditForm({
        title: task.title,
        description: task.description || '',
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        priority: task.priority
      })
    }
  }, [task, isEditing])

  useEffect(() => {
    scrollToBottom()
    // Update read message count in localStorage
    if (messages.length > 0 && typeof window !== 'undefined') {
      const readCounts = JSON.parse(localStorage.getItem('readMessageCounts') || '{}')
      readCounts[taskId] = messages.length
      localStorage.setItem('readMessageCounts', JSON.stringify(readCounts))
    }
  }, [messages, taskId])

  // SSEのみを使用してリアルタイム更新

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
      // インポートされたタスクの場合は元のタスクIDを使用
      const threadTaskId = taskData.importedFromTaskId || taskId
      const messagesResponse = await fetch(`/api/tasks/${threadTaskId}/thread`)
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
      // contentは空でも送信（画像のみの場合）
      formData.append('content', newMessage.trim())
      
      selectedImages.forEach((image, index) => {
        formData.append(`images`, image)
      })

      // インポートされたタスクの場合は元のタスクIDを使用
      const threadTaskId = task?.importedFromTaskId || taskId
      const response = await fetch(`/api/tasks/${threadTaskId}/thread`, {
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

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only set isDragging to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length > 0) {
      const validFiles = imageFiles.filter(file => {
        if (file.size > 5 * 1024 * 1024) {
          setError(`画像 "${file.name}" は5MBを超えています`)
          return false
        }
        return true
      })
      setSelectedImages([...selectedImages, ...validFiles])
    }
  }

  const saveTaskEdits = async () => {
    if (!editForm.title.trim()) {
      setError('タイトルは必須です')
      return
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          dueDate: editForm.dueDate || null,
          priority: editForm.priority
        })
      })

      if (response.ok) {
        const updatedTask = await response.json()
        setTask(updatedTask)
        setIsEditing(false)
        setError(null)
      } else {
        setError('更新に失敗しました')
      }
    } catch (error) {
      console.error('Failed to update task:', error)
      setError('更新中にエラーが発生しました')
    }
  }

  // Handle real-time updates
  const handleSSEMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      
      // Check both current task ID and original task ID for imported tasks
      const threadTaskId = task?.importedFromTaskId || taskId
      if (data.type === 'thread-message' && (data.taskId === taskId || data.taskId === threadTaskId)) {
        setMessages(prevMessages => [...prevMessages, data.message])
      }
    } catch (error) {
      console.error('Error handling SSE message:', error)
    }
  }, [taskId, task?.importedFromTaskId])

  // Set up SSE connection
  useSSE('/api/events', {
    onMessage: handleSSEMessage,
    onOpen: () => console.log('Real-time thread updates connected'),
    onError: () => console.log('Real-time thread updates disconnected')
  })

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
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="text-2xl font-semibold px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <h1 className={`text-2xl font-semibold ${
                          task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                        }`}>
                          {task.title}
                        </h1>
                      )}
                      {isEditing ? (
                        <select
                          value={editForm.priority}
                          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
                          className="px-3 py-1 text-sm font-medium rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="HIGH">高</option>
                          <option value="MEDIUM">中</option>
                          <option value="LOW">低</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 text-sm font-medium rounded-full border ${
                          getPriorityColor(task.priority)
                        }`}>
                          {task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'}
                        </span>
                      )}
                    {task.isShared && (
                      <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
                        <Share2 className="h-3 w-3 inline mr-1" />
                        共有中
                      </span>
                    )}
                    </div>
                    {task.user?.email === session?.user?.email && (
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveTaskEdits}
                              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                            >
                              <Save className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setIsEditing(false)}
                              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                    </div>
                  ) : task.description ? (
                    <p className={`text-lg mb-4 ${
                      task.completed ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {task.description}
                    </p>
                  ) : null}

                  {task.category && (
                    <div className="mb-4">
                      <span className="px-3 py-1 text-sm font-medium rounded-md bg-blue-50 text-blue-700">
                        📁 {task.category}
                      </span>
                    </div>
                  )}

                  {/* 共有情報の表示 */}
                  {task.importedFromUser && (
                    <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm text-blue-700">
                        📥 このタスクは <strong>{task.importedFromUser.name || task.importedFromUser.email}</strong> さんから共有されました
                      </p>
                    </div>
                  )}
                  
                  {task.sharedWith && task.sharedWith.length > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200">
                      <p className="text-sm text-green-700 mb-2">
                        🔗 以下のユーザーと共有中:
                      </p>
                      <ul className="text-sm text-green-600 space-y-1">
                        {task.sharedWith.map((share, index) => (
                          <li key={index}>
                            • {share.sharedBy.name || share.sharedBy.email}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ステータス変更 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ステータス
                    </label>
                    <select
                      value={task.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
                        try {
                          const response = await fetch(`/api/tasks/${taskId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              status: newStatus,
                              completed: newStatus === 'COMPLETED'
                            })
                          })
                          if (response.ok) {
                            const updatedTask = await response.json()
                            setTask(updatedTask)
                          }
                        } catch (error) {
                          console.error('Failed to update status:', error)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={task.user?.email !== session?.user?.email}
                    >
                      <option value="PENDING">未着手</option>
                      <option value="IN_PROGRESS">進行中</option>
                      <option value="COMPLETED">完了</option>
                    </select>
                    {task.user?.email !== session?.user?.email && (
                      <p className="mt-1 text-xs text-gray-500">
                        タスクの作成者のみステータスを変更できます
                      </p>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">期限</label>
                      <input
                        type="date"
                        value={editForm.dueDate}
                        onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                        className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div className="space-y-2 text-sm text-gray-500">
                    {!isEditing && task.dueDate && (
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
                      <span>作成者: {task.user?.name || task.user?.email || '不明'}</span>
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
                  ))}
                </AnimatePresence>
              )}
              <div ref={messagesEndRef} />
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
            <div 
              className={`p-4 border-t relative ${
                isDragging ? 'bg-blue-50 border-blue-300' : ''
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 z-10 pointer-events-none">
                  <div className="text-blue-600 font-medium flex items-center space-x-2">
                    <ImageIcon className="h-8 w-8" />
                    <span>画像をここにドロップ</span>
                  </div>
                </div>
              )}
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
                    ref={fileInputRef}
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