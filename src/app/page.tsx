'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Trash2,
  Edit3,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { formatDate, getDaysUntilDue } from '../lib/utils'

interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string | null
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  completed: boolean
  position: number
  tags: string[]
  category?: string | null
  createdAt: string
  updatedAt: string
}

export default function Home() {
  const { data: session, status } = useSession()
  const [tasks, setTasks] = useState<Task[]>([])
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode')
      return saved ? JSON.parse(saved) : false
    }
    return false
  })
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'title' | 'createdAt'>('dueDate')
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [category, setCategory] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [groupByCategory, setGroupByCategory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  const router = useRouter()

  // Save dark mode preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', JSON.stringify(darkMode))
      if (darkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [darkMode])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // Initialize application on first load
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await fetch('/api/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {
        console.log('App initialization completed or skipped')
      }
    }

    initializeApp()
  }, []) // Run only once on component mount

  // Fetch tasks
  useEffect(() => {
    if (session) {
      fetchTasks()
    }
  }, [session])

  // Extract unique categories when tasks change
  useEffect(() => {
    const uniqueCategories = [...new Set(tasks.filter(task => task.category).map(task => task.category!))]
    setCategories(uniqueCategories)
  }, [tasks])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const tasksData = await response.json()
        setTasks(tasksData)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const addTask = async () => {
    if (!title.trim()) {
      setError('タスクのタイトルを入力してください')
      return
    }

    setIsSubmitting(true)
    setError(null)

    // Handle new category creation
    let finalCategory = category
    if (newCategory.trim()) {
      finalCategory = newCategory.trim()
      setNewCategory('')
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          dueDate: dueDate || null,
          priority,
          category: finalCategory || null,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTasks([...tasks, data])
        setTitle('')
        setDescription('')
        setDueDate('')
        setPriority('MEDIUM')
        setCategory('')
        setShowForm(false)
        setError(null)
      } else {
        setError(data.error || 'タスクの作成に失敗しました')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      setError('ネットワークエラーが発生しました。再度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: !task.completed,
          status: !task.completed ? 'COMPLETED' : 'PENDING',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTasks(tasks.map(t => t.id === id ? data : t))
        setError(null)
      } else {
        setError(data.error || 'タスクの更新に失敗しました')
      }
    } catch (error) {
      console.error('Error updating task:', error)
      setError('ネットワークエラーが発生しました。再度お試しください。')
    }
  }

  const deleteTask = async (id: string) => {
    if (!confirm('このタスクを削除しますか？')) {
      return
    }

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        setTasks(tasks.filter(t => t.id !== id))
        setError(null)
      } else {
        setError(data.error || 'タスクの削除に失敗しました')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      setError('ネットワークエラーが発生しました。再度お試しください。')
    }
  }

  const updateCategory = async (oldCategory: string, newCategory: string) => {
    if (!newCategory.trim() || oldCategory === newCategory.trim()) {
      setEditingCategory(null)
      return
    }

    try {
      // Get all tasks with the old category
      const tasksToUpdate = tasks.filter(task => task.category === oldCategory)
      
      // Update each task
      const updatePromises = tasksToUpdate.map(task =>
        fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: newCategory.trim(),
          }),
        })
      )

      const responses = await Promise.all(updatePromises)
      const allSuccessful = responses.every(response => response.ok)

      if (allSuccessful) {
        // Update local state
        setTasks(tasks.map(task => 
          task.category === oldCategory 
            ? { ...task, category: newCategory.trim() }
            : task
        ))
        setEditingCategory(null)
        setError(null)
      } else {
        setError('一部のタスクの更新に失敗しました')
      }
    } catch (error) {
      console.error('Error updating category:', error)
      setError('カテゴリーの更新に失敗しました')
    }
  }

  const deleteCategory = async (categoryToDelete: string) => {
    if (!confirm(`カテゴリー「${categoryToDelete}」のすべてのタスクを未分類に移動しますか？`)) {
      return
    }

    try {
      // Get all tasks with this category
      const tasksToUpdate = tasks.filter(task => task.category === categoryToDelete)
      
      // Update each task to remove category
      const updatePromises = tasksToUpdate.map(task =>
        fetch(`/api/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: null,
          }),
        })
      )

      const responses = await Promise.all(updatePromises)
      const allSuccessful = responses.every(response => response.ok)

      if (allSuccessful) {
        // Update local state
        setTasks(tasks.map(task => 
          task.category === categoryToDelete 
            ? { ...task, category: null }
            : task
        ))
        setError(null)
      } else {
        setError('一部のタスクの更新に失敗しました')
      }
    } catch (error) {
      console.error('Error deleting category:', error)
      setError('カテゴリーの削除に失敗しました')
    }
  }

  const getPriorityColor = (priority: string) => {
    if (darkMode) {
      switch (priority) {
        case 'HIGH': return 'bg-red-900/30 text-red-300 border-red-700/50'
        case 'MEDIUM': return 'bg-yellow-900/30 text-yellow-300 border-yellow-700/50'
        case 'LOW': return 'bg-green-900/30 text-green-300 border-green-700/50'
        default: return 'bg-gray-700/30 text-gray-300 border-gray-600/50'
      }
    } else {
      switch (priority) {
        case 'HIGH': return 'bg-red-50 text-red-700 border-red-200'
        case 'MEDIUM': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
        case 'LOW': return 'bg-green-50 text-green-700 border-green-200'
        default: return 'bg-gray-50 text-gray-700 border-gray-200'
      }
    }
  }

  const filteredAndSortedTasks = useMemo(() => {
    return tasks
      .filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             task.description?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesFilter = filterStatus === 'all' || 
                             (filterStatus === 'completed' && task.completed) ||
                             (filterStatus === 'pending' && !task.completed)
        return matchesSearch && matchesFilter
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'dueDate':
            if (!a.dueDate) return 1
            if (!b.dueDate) return -1
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          case 'priority':
            const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
            return priorityOrder[b.priority] - priorityOrder[a.priority]
          case 'title':
            return a.title.localeCompare(b.title)
          case 'createdAt':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          default:
            return 0
        }
      })
  }, [tasks, searchQuery, filterStatus, sortBy])

  // Group tasks by category if enabled
  const groupedTasks = groupByCategory ? 
    filteredAndSortedTasks.reduce((groups, task) => {
      const category = task.category || '未分類'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(task)
      return groups
    }, {} as Record<string, Task[]>) : 
    { '': filteredAndSortedTasks }

  // Don't render anything while authentication is loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Don't render if not authenticated (will redirect)
  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-blue-50 via-white to-indigo-50'
    }`}>
      {/* Header */}
      <header className={`border-b transition-colors backdrop-blur-sm ${
        darkMode 
          ? 'bg-gray-800/80 border-gray-700/50' 
          : 'bg-white/80 border-gray-200/50'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className={`text-xl font-semibold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                ✨ Simple ToDo
              </h1>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                  darkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <input
                  type="text"
                  placeholder="タスクを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-9 pr-4 py-2 rounded-lg border text-sm transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  すべて
                </button>
                <button
                  onClick={() => setFilterStatus('pending')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filterStatus === 'pending'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  未完了
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  完了済み
                </button>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'title' | 'createdAt')}
                className={`text-sm border rounded-lg px-3 py-1.5 transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-200' 
                    : 'bg-white border-gray-200 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="dueDate">期限順</option>
                <option value="priority">優先度順</option>
                <option value="title">タイトル順</option>
                <option value="createdAt">作成日順</option>
              </select>

              <button
                onClick={() => setGroupByCategory(!groupByCategory)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                  groupByCategory
                    ? darkMode 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-blue-600 text-white border-blue-600'
                    : darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' 
                      : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
                }`}
              >
                分類表示
              </button>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {session && (
                <Link href="/auth/signout">
                  <button
                    className={`p-2 rounded-lg transition-colors ${
                      darkMode 
                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Global Error Display */}
      {error && !showForm && (
        <div className={`mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 pt-4`}>
          <div className={`p-4 rounded-lg border ${
            darkMode 
              ? 'bg-red-900/20 border-red-700 text-red-300' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <div className="flex items-center justify-between">
              <p className="text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className={`ml-4 text-sm underline ${
                  darkMode ? 'hover:text-red-200' : 'hover:text-red-600'
                }`}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add Task Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className={`w-full p-6 border-2 border-dashed rounded-xl transition-all group ${
                darkMode 
                  ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300 hover:bg-gray-800/50' 
                  : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Plus className="h-5 w-5" />
                <span className="font-medium">新しいタスクを追加</span>
              </div>
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-6 rounded-xl border transition-all duration-300 ${
                darkMode 
                  ? 'bg-gray-800/70 backdrop-blur-xl border-gray-700/50' 
                  : 'bg-white/70 backdrop-blur-xl border-gray-200/50'
              } shadow-xl hover:shadow-2xl`}
            >
              <div className="space-y-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="タスクのタイトル..."
                  className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 text-lg font-medium ${
                    darkMode 
                      ? 'bg-gray-700/50 backdrop-blur-sm border-gray-600/50 text-white placeholder-gray-400 focus:bg-gray-700/70' 
                      : 'bg-white/50 backdrop-blur-sm border-gray-200/50 text-gray-900 placeholder-gray-500 focus:bg-white/70'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:border-gray-400/50`}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                />
                
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="詳細な説明（オプション）..."
                  rows={3}
                  className={`w-full px-4 py-3 rounded-lg border transition-colors resize-none ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      期限
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-200 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      優先度
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-200 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    >
                      <option value="LOW">低</option>
                      <option value="MEDIUM">中</option>
                      <option value="HIGH">高</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      分類
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-200 text-gray-900'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    >
                      <option value="">分類なし</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* New category input */}
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    darkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    新しい分類を作成
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="新しい分類名..."
                    className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                  />
                </div>

                {/* Error display */}
                {error && (
                  <div className={`p-3 rounded-lg border ${
                    darkMode 
                      ? 'bg-red-900/20 border-red-700 text-red-300' 
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <p className="text-sm">{error}</p>
                  </div>
                )}
                
                <div className="flex space-x-3 pt-2">
                  <Button 
                    onClick={addTask} 
                    className="flex-1"
                    loading={isSubmitting}
                  >
                    {!isSubmitting && <Plus className="h-4 w-4 mr-2" />}
                    {isSubmitting ? '作成中...' : 'タスクを追加'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false)
                      setError(null)
                    }}
                    className="px-6"
                    disabled={isSubmitting}
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Tasks List */}
        <div className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredAndSortedTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-center py-16 rounded-xl backdrop-blur-sm ${
                darkMode ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white/50 border border-gray-200/50'
              }`}
            >
              <div className={`text-6xl mb-4 ${
                darkMode ? 'text-gray-600' : 'text-gray-300'
              }`}>
                📝
              </div>
              <p className={`text-lg font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {searchQuery || filterStatus !== 'all' ? 'タスクが見つかりません' : 'タスクがありません'}
              </p>
              <p className={`text-sm ${
                darkMode ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {searchQuery || filterStatus !== 'all' ? '検索条件を変更してみてください' : '上のボタンから新しいタスクを追加してください'}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {Object.entries(groupedTasks).map(([categoryName, categoryTasks]) => (
                <motion.div
                  key={categoryName}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-3"
                >
                  {groupByCategory && categoryName && (
                    <div className={`py-3 ${
                      darkMode ? 'border-gray-700' : 'border-gray-200'
                    } border-b`}>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => {
                            const newCollapsed = new Set(collapsedCategories)
                            if (collapsedCategories.has(categoryName)) {
                              newCollapsed.delete(categoryName)
                            } else {
                              newCollapsed.add(categoryName)
                            }
                            setCollapsedCategories(newCollapsed)
                          }}
                          className={`flex items-center space-x-2 rounded-lg p-2 -ml-2 transition-colors cursor-pointer focus:outline-none ${
                            darkMode 
                              ? 'hover:bg-gray-700 hover:bg-opacity-100' 
                              : 'hover:bg-blue-50 hover:bg-opacity-100'
                          }`}
                          style={{
                            transition: 'background-color 0.15s ease-in-out'
                          }}
                        >
                          {collapsedCategories.has(categoryName) ? (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                          <div className="flex items-center space-x-3">
                            {editingCategory === categoryName ? (
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">📁</span>
                                <input
                                  type="text"
                                  value={editCategoryName}
                                  onChange={(e) => setEditCategoryName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updateCategory(categoryName, editCategoryName)
                                    } else if (e.key === 'Escape') {
                                      setEditingCategory(null)
                                    }
                                  }}
                                  onBlur={() => updateCategory(categoryName, editCategoryName)}
                                  className={`text-lg font-semibold bg-transparent border-b-2 ${
                                    darkMode 
                                      ? 'text-white border-blue-400 focus:border-blue-300' 
                                      : 'text-gray-900 border-blue-600 focus:border-blue-500'
                                  } focus:outline-none`}
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <div className="flex items-center space-x-3">
                                <span className="text-lg">📁</span>
                                <h2 className={`text-lg font-semibold ${
                                  darkMode ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {categoryName}
                                </h2>
                              </div>
                            )}
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {categoryTasks.length}個
                            </span>
                          </div>
                        </button>
                        
                        {categoryName !== '未分類' && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                setEditingCategory(categoryName)
                                setEditCategoryName(categoryName)
                              }}
                              className={`p-1 rounded transition-colors ${
                                darkMode 
                                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' 
                                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                              }`}
                              title="カテゴリー名を編集"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteCategory(categoryName)}
                              className={`p-1 rounded transition-colors ${
                                darkMode 
                                  ? 'text-gray-400 hover:text-red-400 hover:bg-gray-700' 
                                  : 'text-gray-500 hover:text-red-500 hover:bg-gray-100'
                              }`}
                              title="カテゴリーを削除"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!collapsedCategories.has(categoryName) && (
                    <div className="space-y-3">
                      {categoryTasks.map((task, index) => {
                      const daysUntilDue = getDaysUntilDue(task.dueDate || null)
                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className={`p-6 rounded-xl border transition-all duration-300 hover:shadow-xl group ${
                            task.completed ? 'opacity-60' : ''
                          } ${
                            darkMode 
                              ? 'bg-gray-800/50 backdrop-blur-sm border-gray-700/50 hover:bg-gray-800/70 hover:border-gray-600' 
                              : 'bg-white/70 backdrop-blur-sm border-gray-200/50 hover:bg-white hover:border-gray-300 hover:shadow-blue-100/50'
                          } ${
                            task.priority === 'HIGH' ? 'priority-high' :
                            task.priority === 'MEDIUM' ? 'priority-medium' : 'priority-low'
                          }`}
                        >
                          <div className="flex items-start space-x-4">
                            <button
                              onClick={() => toggleTask(task.id)}
                              className={`mt-1 transition-colors ${
                                task.completed 
                                  ? 'text-green-500' 
                                  : darkMode ? 'text-gray-400 hover:text-green-400' : 'text-gray-400 hover:text-green-500'
                              }`}
                            >
                              {task.completed ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <Circle className="h-5 w-5" />
                              )}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-3 mb-2">
                                <h3
                                  className={`font-semibold text-lg ${
                                    task.completed 
                                      ? darkMode ? 'text-gray-500 line-through' : 'text-gray-500 line-through'
                                      : darkMode ? 'text-white' : 'text-gray-900'
                                  }`}
                                >
                                  {task.title}
                                </h3>
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(task.priority)}`}
                                >
                                  {task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'}
                                </span>
                                {!groupByCategory && task.category && (
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded-md ${
                                      darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'
                                    }`}
                                  >
                                    📁 {task.category}
                                  </span>
                                )}
                              </div>
                              
                              {task.description && (
                                <p
                                  className={`text-sm mb-3 ${
                                    task.completed 
                                      ? darkMode ? 'text-gray-500' : 'text-gray-400'
                                      : darkMode ? 'text-gray-300' : 'text-gray-600'
                                  }`}
                                >
                                  {task.description}
                                </p>
                              )}
                              
                              <div className={`flex items-center space-x-4 text-xs ${
                                darkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>
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
                            
                            <button
                              onClick={() => deleteTask(task.id)}
                              className={`opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all ${
                                darkMode 
                                  ? 'text-gray-500 hover:text-red-400 hover:bg-gray-700' 
                                  : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Stats */}
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-8 p-4 rounded-lg text-center text-sm ${
              darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'
            }`}
          >
            {tasks.filter(task => task.completed).length} / {tasks.length} タスク完了
            {tasks.filter(task => !task.completed && task.dueDate && getDaysUntilDue(task.dueDate)! < 0).length > 0 && (
              <span className="ml-2 text-red-500">
                • {tasks.filter(task => !task.completed && task.dueDate && getDaysUntilDue(task.dueDate)! < 0).length} 期限切れ
              </span>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}