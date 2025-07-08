'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
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
  XCircle,
  RefreshCw
} from 'lucide-react'
import { formatDate, getDaysUntilDue } from '@/lib/utils'
import ImageModal from '@/components/ImageModal'
import { useSSE } from '@/lib/sse-client'
import { useDarkMode } from '@/hooks/useDarkMode'
import { PRIORITY, TASK_STATUS } from '@/constants'

interface TaskDetail {
  id: string
  title: string
  description?: string
  dueDate?: string | null
  priority: typeof PRIORITY[keyof typeof PRIORITY]
  status: typeof TASK_STATUS[keyof typeof TASK_STATUS]
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
  _count?: {
    threadMessages: number
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
  const { darkMode } = useDarkMode()
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
  const [isSaving, setIsSaving] = useState(false)
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
  
  // Separate effect for registering task viewer to handle imported tasks
  useEffect(() => {
    if (session && task) {
      // Register this user as viewing the task
      fetch(`/api/tasks/${taskId}/view`, {
        method: 'POST',
        credentials: 'same-origin'
      }).catch(err => console.error('Failed to register task viewer:', err))
      
      // If this is an imported task, also register for the original
      if (task.importedFromTaskId) {
        fetch(`/api/tasks/${task.importedFromTaskId}/view`, {
          method: 'POST',
          credentials: 'same-origin'
        }).catch(err => console.error('Failed to register original task viewer:', err))
      }
      
      // Cleanup: unregister when leaving the page
      return () => {
        fetch(`/api/tasks/${taskId}/view`, {
          method: 'DELETE',
          credentials: 'same-origin'
        }).catch(err => console.error('Failed to unregister task viewer:', err))
        
        if (task.importedFromTaskId) {
          fetch(`/api/tasks/${task.importedFromTaskId}/view`, {
            method: 'DELETE',
            credentials: 'same-origin'
          }).catch(err => console.error('Failed to unregister original task viewer:', err))
        }
      }
    }
  }, [taskId, session, task?.importedFromTaskId])

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
    console.log('[sendMessage] Starting to send message')
    console.log('[sendMessage] Message content:', newMessage)
    console.log('[sendMessage] Message trimmed:', newMessage.trim())
    console.log('[sendMessage] Images count:', selectedImages.length)
    
    try {
      const formData = new FormData()
      // contentは空でも送信（画像のみの場合）
      formData.append('content', newMessage.trim())
      console.log('[sendMessage] FormData content appended')
      
      selectedImages.forEach((image, index) => {
        formData.append(`images`, image)
        console.log(`[sendMessage] Image ${index} appended:`, image.name)
      })

      // インポートされたタスクの場合は元のタスクIDを使用
      const threadTaskId = task?.importedFromTaskId || taskId
      console.log('[sendMessage] Thread Task ID:', threadTaskId)
      console.log('[sendMessage] Sending POST request...')
      
      const response = await fetch(`/api/tasks/${threadTaskId}/thread`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin', // クッキーを含める
      })
      
      console.log('[sendMessage] Response status:', response.status)
      console.log('[sendMessage] Response ok:', response.ok)

      if (response.ok) {
        const newMsg = await response.json()
        console.log('[sendMessage] New message received:', newMsg)
        setMessages([...messages, newMsg])
        setNewMessage('')
        setSelectedImages([])
        console.log('[sendMessage] Message sent successfully')
      } else {
        const errorText = await response.text()
        console.error('[sendMessage] Error response text:', errorText)
        
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch (e) {
          errorData = { error: errorText || 'Unknown error' }
        }
        
        console.error('Failed to send message:', errorData)
        setError(`メッセージの送信に失敗しました: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[sendMessage] Caught error:', error)
      console.error('[sendMessage] Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('[sendMessage] Error message:', error instanceof Error ? error.message : String(error))
      setError('メッセージの送信に失敗しました')
    } finally {
      setSendingMessage(false)
      console.log('[sendMessage] Finished')
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
    console.log('[Task Edit] saveTaskEdits called')
    if (!editForm.title.trim()) {
      setError('タイトルは必須です')
      return
    }

    setIsSaving(true)
    setError(null)

    // 楽観的更新: 即座にUIを閲覧モードに戻す
    setIsEditing(false)
    
    // 元のタスク情報を保存（エラー時のロールバック用）
    const originalTask = task ? { ...task } : null
    
    // 楽観的更新: 即座にタスクを更新
    if (task) {
      setTask({
        ...task,
        title: editForm.title.trim(),
        description: editForm.description.trim() || undefined,
        dueDate: editForm.dueDate || undefined,
        priority: editForm.priority
      })
    }

    // タイムアウト設定を追加（5秒に短縮）
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.error('[Task Edit] Request timeout after 5 seconds')
      controller.abort()
    }, 5000) // 5秒タイムアウト

    try {
      const requestBody = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        dueDate: editForm.dueDate || null,
        priority: editForm.priority
      }
      
      console.log('[Task Edit] Sending PUT request to:', `/api/tasks/${taskId}`)
      console.log('[Task Edit] Request body:', requestBody)
      
      const startTime = Date.now()
      
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      const responseTime = Date.now() - startTime
      console.log(`[Task Edit] Response received in ${responseTime}ms, status:`, response.status)
      
      if (response.ok) {
        const updatedTask = await response.json()
        console.log('[Task Edit] Task updated successfully:', updatedTask)
        setTask(updatedTask)
        setError(null)
        // 既に楽観的更新でsetIsEditing(false)を実行済み
      } else {
        const errorData = await response.json()
        console.error('[Task Edit] Update failed:', errorData)
        setError(errorData.error || '更新に失敗しました')
        // エラー時はロールバック
        if (originalTask) {
          setTask(originalTask)
        }
        setIsEditing(true)
      }
    } catch (error: any) {
      console.error('[Task Edit] Failed to update task:', error)
      if (error.name === 'AbortError') {
        setError('保存がタイムアウトしました。もう一度お試しください。')
      } else {
        setError('更新中にエラーが発生しました')
      }
      // エラー時はロールバック
      if (originalTask) {
        setTask(originalTask)
      }
      setIsEditing(true)
    } finally {
      clearTimeout(timeoutId)
      setIsSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: typeof TASK_STATUS[keyof typeof TASK_STATUS]) => {
    console.log('handleStatusChange called with status:', newStatus)
    try {
      console.log('Sending PATCH request to:', `/api/tasks/${taskId}`)
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          completed: newStatus === TASK_STATUS.COMPLETED
        })
      })
      
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const updatedTask = await response.json()
        console.log('Status updated successfully:', updatedTask)
        setTask(updatedTask)
        setError(null)
      } else {
        const errorData = await response.json()
        console.error('Status update failed:', errorData)
        setError(errorData.error || 'ステータスの更新に失敗しました')
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      setError('ステータスの更新中にエラーが発生しました')
    }
  }

  // Handle real-time updates
  const handleSSEMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      
      // Check both current task ID and original task ID for imported tasks
      const threadTaskId = task?.importedFromTaskId || taskId
      
      switch (data.type) {
        case 'thread-message-added':
          // Real-time thread message
          if (data.taskId === taskId || data.taskId === threadTaskId) {
            setMessages(prevMessages => {
              // Check if message already exists to avoid duplicates
              const exists = prevMessages.some(msg => msg.id === data.message.id)
              if (!exists) {
                return [...prevMessages, data.message]
              }
              return prevMessages
            })
          }
          break
        
        case 'task-updated':
        case 'shared-task-updated':
          // Update task details when modified
          if (data.task && (data.task.id === taskId || 
              (task?.importedFromTaskId && data.task.id === task.importedFromTaskId))) {
            setTask(prevTask => ({
              ...prevTask,
              ...data.task,
              // 既存の関連情報を保持
              _count: data.task._count || prevTask?._count,
              sharedWith: data.task.sharedWith || prevTask?.sharedWith,
              importedFromUser: data.task.importedFromUser || prevTask?.importedFromUser
            }))
          }
          break
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
    if (darkMode) {
      switch (priority) {
        case PRIORITY.HIGH: return 'bg-red-900/30 text-red-300 border-red-700/50'
        case PRIORITY.MEDIUM: return 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50'
        case PRIORITY.LOW: return 'bg-green-900/30 text-green-300 border-green-700/50'
        default: return 'bg-gray-700/30 text-gray-300 border-gray-600/50'
      }
    } else {
      switch (priority) {
        case PRIORITY.HIGH: return 'bg-red-50 text-red-700 border-red-200'
        case PRIORITY.MEDIUM: return 'bg-yellow-50 text-yellow-700 border-yellow-200'
        case PRIORITY.LOW: return 'bg-green-50 text-green-700 border-green-200'
        default: return 'bg-gray-50 text-gray-700 border-gray-200'
      }
    }
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <h1 className={`text-2xl font-semibold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>エラー</h1>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{error || 'タスクが見つかりません'}</p>
          <button
            onClick={() => router.back()}
            className={`mt-4 px-4 py-2 rounded-lg transition-colors ${
              darkMode 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  const daysUntilDue = getDaysUntilDue(task.dueDate || null)

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'
    }`}>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
        {/* ヘッダー */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className={`flex items-center space-x-2 transition-colors ${
              darkMode 
                ? 'text-gray-300 hover:text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
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
            className={`rounded-xl shadow-lg p-6 ${
              darkMode 
                ? 'bg-gray-800/70 border border-gray-700/50' 
                : 'bg-white'
            }`}
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
                          className={`text-2xl font-semibold px-3 py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-100' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        />
                      ) : (
                        <h1 className={`text-2xl font-semibold ${
                          task.completed ? 'text-gray-500 line-through' : darkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          {task.title}
                        </h1>
                      )}
                      {isEditing ? (
                        <select
                          value={editForm.priority}
                          onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as typeof PRIORITY[keyof typeof PRIORITY] })}
                          className={`px-3 py-1 text-sm font-medium rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-100' 
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          <option value={PRIORITY.HIGH}>高</option>
                          <option value={PRIORITY.MEDIUM}>中</option>
                          <option value={PRIORITY.LOW}>低</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 text-sm font-medium rounded-full border ${
                          getPriorityColor(task.priority)
                        }`}>
                          {task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'}
                        </span>
                      )}
                    {task.isShared && (
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-700'
                      }`}>
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
                              disabled={isSaving}
                              className={`p-2 rounded-lg transition-colors ${
                                isSaving 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : darkMode 
                                    ? 'text-green-400 hover:text-green-300 hover:bg-green-900/20'
                                    : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                              }`}
                            >
                              {isSaving ? (
                                <RefreshCw className="h-5 w-5 animate-spin" />
                              ) : (
                                <Save className="h-5 w-5" />
                              )}
                            </button>
                            <button
                              onClick={() => setIsEditing(false)}
                              className={`p-2 rounded-lg transition-colors ${
                                darkMode 
                                  ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                                  : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              }`}
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setIsEditing(true)}
                            className={`p-2 rounded-lg transition-colors ${
                              darkMode 
                                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                                : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mb-4">
                      <label className={`block text-sm font-medium mb-1 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>説明</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100' 
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                        rows={3}
                      />
                    </div>
                  ) : task.description ? (
                    <p className={`text-lg mb-4 ${
                      task.completed ? 'text-gray-400' : darkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {task.description}
                    </p>
                  ) : null}

                  {task.category && (
                    <div className="mb-4">
                      <span className={`px-3 py-1 text-sm font-medium rounded-md ${
                        darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'
                      }`}>
                        📁 {task.category}
                      </span>
                    </div>
                  )}

                  {/* 共有情報の表示 */}
                  {task.importedFromUser && (
                    <div className={`mb-4 p-3 rounded-lg border ${
                      darkMode 
                        ? 'bg-blue-900/20 border-blue-800/50' 
                        : 'bg-blue-50 border-blue-200'
                    }`}>
                      <p className={`text-sm ${
                        darkMode ? 'text-blue-300' : 'text-blue-700'
                      }`}>
                        📥 このタスクは <strong>{task.importedFromUser.name || task.importedFromUser.email}</strong> さんから共有されました
                      </p>
                    </div>
                  )}
                  
                  {task.sharedWith && task.sharedWith.length > 0 && (
                    <div className={`mb-4 p-3 rounded-lg border ${
                      darkMode 
                        ? 'bg-green-900/20 border-green-800/50' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                      <p className={`text-sm mb-2 ${
                        darkMode ? 'text-green-300' : 'text-green-700'
                      }`}>
                        🔗 以下のユーザーと共有中:
                      </p>
                      <ul className={`text-sm space-y-1 ${
                        darkMode ? 'text-green-400' : 'text-green-600'
                      }`}>
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
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      ステータス
                    </label>
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(e.target.value as typeof TASK_STATUS[keyof typeof TASK_STATUS])}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-100' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      disabled={task.user?.email !== session?.user?.email}
                    >
                      <option value={TASK_STATUS.PENDING}>未着手</option>
                      <option value={TASK_STATUS.IN_PROGRESS}>進行中</option>
                      <option value={TASK_STATUS.COMPLETED}>完了</option>
                    </select>
                    {task.user?.email !== session?.user?.email && (
                      <p className={`mt-1 text-xs ${
                        darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        タスクの作成者のみステータスを変更できます
                      </p>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mb-4">
                      <label className={`block text-sm font-medium mb-1 ${
                        darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>期限</label>
                      <input
                        type="date"
                        value={editForm.dueDate}
                        onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                        className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100' 
                            : 'bg-white border-gray-300 text-gray-900'
                        }`}
                      />
                    </div>
                  )}

                  <div className={`space-y-2 text-sm ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
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
            className={`rounded-xl shadow-lg flex flex-col h-[600px] ${
              darkMode 
                ? 'bg-gray-800/70 border border-gray-700/50' 
                : 'bg-white'
            }`}
          >
            <div className={`p-4 border-b ${
              darkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h2 className={`text-lg font-semibold flex items-center ${
                darkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                <MessageSquare className="h-5 w-5 mr-2" />
                スレッド
              </h2>
            </div>

            {/* メッセージリスト */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className={`text-center py-8 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  <MessageSquare className={`h-12 w-12 mx-auto mb-2 ${
                    darkMode ? 'text-gray-600' : 'text-gray-300'
                  }`} />
                  <p>まだメッセージがありません</p>
                </div>
              ) : (
                <>
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
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            darkMode ? 'bg-gray-600' : 'bg-gray-300'
                          }`}>
                            <User className={`h-4 w-4 ${
                              darkMode ? 'text-gray-300' : 'text-gray-600'
                            }`} />
                          </div>
                        )}
                      </div>
                      <div className={`flex-1 max-w-xs lg:max-w-md ${
                        message.user.email === session?.user?.email ? 'text-right' : ''
                      }`}>
                        <div className={`text-xs mb-1 ${
                          darkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {message.user.name || message.user.email} • {formatDate(message.createdAt)}
                        </div>
                        {message.content && (
                          <div className={`inline-block p-3 rounded-lg ${
                            message.user.email === session?.user?.email 
                              ? 'bg-blue-600 text-white' 
                              : darkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'
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
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 画像プレビュー */}
            {selectedImages.length > 0 && (
              <div className={`px-4 py-2 border-t ${
                darkMode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-200'
              }`}>
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
                isDragging ? (darkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-300') : darkMode ? 'border-gray-700' : 'border-gray-200'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className={`absolute inset-0 flex items-center justify-center bg-opacity-90 z-10 pointer-events-none ${
                  darkMode ? 'bg-blue-900/90' : 'bg-blue-50'
                }`}>
                  <div className={`font-medium flex items-center space-x-2 ${
                    darkMode ? 'text-blue-300' : 'text-blue-600'
                  }`}>
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
                  className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  disabled={sendingMessage}
                />
                <label className={`p-2 cursor-pointer transition-colors ${
                  darkMode 
                    ? 'text-gray-400 hover:text-gray-200' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
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