'use client'

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
  ChevronRight,
  Share2,
  Copy,
  Check,
  MessageSquare,
  Settings,
  RefreshCw
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { formatDate, getDaysUntilDue } from '../lib/utils'

// Custom hooks
import { useTaskState } from '../hooks/useTaskState'
import { useDarkMode } from '../hooks/useDarkMode'
import { useTaskForm } from '../hooks/useTaskForm'
import { useTaskFilters } from '../hooks/useTaskFilters'
import { useCategories } from '../hooks/useCategories'
import { useTaskSharing } from '../hooks/useTaskSharing'
import { useSSEConnection } from '../hooks/useSSEConnection'
import { useTaskOperations } from '../hooks/useTaskOperations'
import { useCategoryOperations } from '../hooks/useCategoryOperations'

// Constants
import { PRIORITY } from '../constants'

export default function Home() {
  const router = useRouter()
  
  // State management hooks
  const {
    session,
    status,
    tasks,
    setTasks,
    loading,
    error,
    setError,
    shareUrls,
    setShareUrls,
    deletingTasks,
    setDeletingTasks,
    fetchTasks
  } = useTaskState()

  const { darkMode, setDarkMode } = useDarkMode()
  
  const {
    showForm,
    setShowForm,
    title,
    setTitle,
    description,
    setDescription,
    dueDate,
    setDueDate,
    priority,
    setPriority,
    category,
    setCategory,
    newCategory,
    setNewCategory,
    showNewCategoryInput,
    setShowNewCategoryInput,
    isSubmitting,
    setIsSubmitting,
    resetForm
  } = useTaskForm()

  const {
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    sortBy,
    setSortBy,
    groupByCategory,
    setGroupByCategory,
    filteredAndSortedTasks
  } = useTaskFilters(tasks)

  const {
    categories,
    collapsedCategories,
    editingCategory,
    setEditingCategory,
    editCategoryName,
    setEditCategoryName,
    categoryShareUrls,
    setCategoryShareUrls,
    copiedCategoryName,
    setCopiedCategoryName,
    toggleCategory
  } = useCategories(tasks)

  const {
    sharingTaskId,
    setSharingTaskId,
    copiedTaskId,
    setCopiedTaskId,
    handleCopyShareUrl
  } = useTaskSharing()

  const {
    sseConnected,
    connectionState,
    readMessageCounts,
    setReadMessageCounts
  } = useSSEConnection(session, tasks, setTasks, fetchTasks, setShareUrls)

  const {
    createTask,
    updateTask: _updateTask,
    deleteTask,
    shareTask,
    toggleTaskComplete
  } = useTaskOperations({
    tasks,
    setTasks,
    setError,
    deletingTasks,
    setDeletingTasks,
    shareUrls,
    setShareUrls
  })

  const {
    handleCategoryUpdate,
    shareCategory,
    handleCopyCategoryShareUrl
  } = useCategoryOperations({
    tasks,
    setTasks,
    setError,
    categoryShareUrls,
    setCategoryShareUrls,
    setEditingCategory,
    setCopiedCategoryName
  })

  // Task operations
  const addTask = async () => {
    console.log('[AddTask] Start - Title:', title)
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
      await createTask({
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || '',
        priority,
        category: finalCategory || ''
      })
      
      resetForm()
      console.log('[AddTask] Complete')
    } catch (error: any) {
      console.error('[AddTask] Exception:', error)
      setError(error.message || 'タスクの作成に失敗しました')
    } finally {
      console.log('[AddTask] Setting isSubmitting to false')
      setIsSubmitting(false)
    }
  }

  const toggleTask = async (id: string) => {
    await toggleTaskComplete(id)
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm('このタスクを削除しますか？')) {
      return
    }
    await deleteTask(id)
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

  const handleShareTask = async (taskId: string) => {
    try {
      console.log('[Share Task] Starting share process for task:', taskId)
      setSharingTaskId(taskId)
      const shareUrl = await shareTask(taskId)
      console.log('[Share Task] Share URL generated:', shareUrl)
      
      // 共有成功時、自動的にURLをコピー
      if (shareUrl) {
        try {
          await navigator.clipboard.writeText(shareUrl)
          // 共有URLコピー機能を使用して視覚的フィードバックを提供
          await handleCopyShareUrl(taskId, shareUrl)
          console.log('[Share Task] URL copied to clipboard')
        } catch (clipboardError) {
          console.error('[Share Task] Failed to copy URL to clipboard:', clipboardError)
          // クリップボードへのコピーに失敗してもエラーとはしない
        }
      }
      
      setError(null) // 成功時はエラーをクリア
    } catch (error: any) {
      console.error('[Share Task] Error sharing task:', error)
      // ユーザーにエラーを通知
      const errorMessage = error.message || 'タスクの共有に失敗しました'
      setError(errorMessage)
      
      // エラーメッセージを3秒後に自動的にクリア
      setTimeout(() => {
        setError(null)
      }, 3000)
    } finally {
      setSharingTaskId(null)
    }
  }

  const unshareTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/share?taskId=${taskId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const newShareUrls = { ...shareUrls }
        delete newShareUrls[taskId]
        setShareUrls(newShareUrls)
        
        // Update the task in local state to reflect unsharing
        setTasks(tasks.map(t => 
          t.id === taskId 
            ? { ...t, shareId: null, isShared: false }
            : t
        ))
      } else {
        setError('共有の解除に失敗しました')
      }
    } catch (error) {
      console.error('Error unsharing task:', error)
      setError('共有の解除に失敗しました')
    }
  }

  const handleShareCategory = async (categoryName: string) => {
    try {
      const shareUrl = await shareCategory(categoryName)
      await handleCopyCategoryShareUrl(categoryName, shareUrl)
    } catch (error) {
      console.error('Error sharing category:', error)
    }
  }

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

  // Group tasks by category if enabled
  const groupedTasks = groupByCategory ? 
    filteredAndSortedTasks.reduce((groups, task) => {
      const category = task.category || '未分類'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(task)
      return groups
    }, {} as Record<string, typeof tasks>) : 
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
      <header className={`border-b transition-colors ${
        darkMode 
          ? 'bg-gray-900/80 backdrop-blur-lg border-gray-700/50' 
          : 'bg-white/90 backdrop-blur-lg border-gray-200/70 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <h1 className={`text-base sm:text-xl font-bold ${
                darkMode ? 'text-white' : 'text-gray-900'
              }`}>
                <span className="hidden sm:inline text-gradient">Simple ToDo</span>
                <span className="sm:hidden text-gradient">ToDo</span>
              </h1>
              <div className="relative hidden sm:block">
                <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                  darkMode ? 'text-gray-200' : 'text-gray-700'
                }`} />
                <input
                  type="text"
                  placeholder="タスクを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-9 pr-4 py-2 rounded-lg border text-sm transition-colors ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-300' 
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Manual refresh button */}
              {!sseConnected && (
                <button
                  onClick={fetchTasks}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode
                      ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  title="手動で更新"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              )}
              
              <div className="hidden sm:flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  すべて
                </button>
                <button
                  onClick={() => setFilterStatus('pending')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filterStatus === 'pending'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  未完了
                </button>
                <button
                  onClick={() => setFilterStatus('completed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  完了済み
                </button>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'title' | 'createdAt')}
                className={`text-xs sm:text-sm border rounded-lg px-2 sm:px-3 py-1.5 transition-colors ${
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
                className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-colors ${
                  groupByCategory
                    ? darkMode 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-blue-600 text-white border-blue-600'
                    : darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' 
                      : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="hidden sm:inline">分類表示</span>
                <span className="sm:hidden">分類</span>
              </button>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <div className="flex items-center space-x-2 pl-2 sm:pl-4 border-l border-gray-300 dark:border-gray-600">
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm`}>
                    {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'U'}
                  </div>
                  <div className="hidden sm:block">
                    <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      {session?.user?.name || session?.user?.email}
                    </p>
                  </div>
                </div>
                <Link
                  href="/account"
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode
                      ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  title="アカウント設定"
                >
                  <Settings className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth/signout"
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode
                      ? 'hover:bg-gray-700 text-gray-300 hover:text-white'
                      : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }`}
                  title="ログアウト"
                >
                  <LogOut className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Mobile Search Bar */}
        <div className="relative sm:hidden mb-4">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
            darkMode ? 'text-gray-200' : 'text-gray-700'
          }`} />
          <input
            type="text"
            placeholder="タスクを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2 rounded-lg border text-sm transition-colors ${
              darkMode 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-300' 
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-600'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>

        {/* Mobile Filter Buttons */}
        <div className="sm:hidden mb-4">
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterStatus === 'pending'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              未完了
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              完了済み
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg ${
              darkMode 
                ? 'bg-red-900/20 border border-red-700/50 text-red-400' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {error}
          </motion.div>
        )}

        {/* Add task button */}
        <button
          onClick={() => setShowForm(true)}
          className={`mb-6 w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all transform hover:scale-[1.02] active:scale-95 btn-modern ${
            darkMode 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25' 
              : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30'
          }`}
        >
          <Plus className="h-5 w-5" />
          <span>新しいタスクを追加</span>
        </button>

        {/* Add task form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mb-6 p-4 sm:p-6 rounded-xl border glass fade-in`}
            >
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="タスクのタイトル"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                
                <textarea
                  placeholder="説明（オプション）"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                    darkMode 
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-600 text-white' 
                        : 'bg-white border-gray-200 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                  
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
                    className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                      darkMode 
                        ? 'bg-gray-800 border-gray-600 text-white' 
                        : 'bg-white border-gray-200 text-gray-900'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  >
                    <option value="LOW">低優先度</option>
                    <option value="MEDIUM">中優先度</option>
                    <option value="HIGH">高優先度</option>
                  </select>
                  
                  <div className="flex-1">
                    {!showNewCategoryInput ? (
                      <div className="flex space-x-2">
                        <select
                          value={category}
                          onChange={(e) => {
                            if (e.target.value === '__new__') {
                              setShowNewCategoryInput(true)
                              setCategory('')
                            } else {
                              setCategory(e.target.value)
                            }
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                            darkMode 
                              ? 'bg-gray-800 border-gray-600 text-white' 
                              : 'bg-white border-gray-200 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        >
                          <option value="">カテゴリーなし</option>
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="__new__">+ 新しいカテゴリー</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="新しいカテゴリー名"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          autoFocus
                          className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-300' 
                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-600'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        />
                        <button
                          onClick={() => {
                            setShowNewCategoryInput(false)
                            setNewCategory('')
                          }}
                          className={`px-3 py-2 rounded-lg transition-colors ${
                            darkMode 
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          キャンセル
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <Button
                    onClick={() => {
                      setShowForm(false)
                      setTitle('')
                      setDescription('')
                      setDueDate('')
                      setPriority(PRIORITY.MEDIUM as 'MEDIUM')
                      setCategory('')
                      setNewCategory('')
                      setShowNewCategoryInput(false)
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      darkMode 
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    キャンセル
                  </Button>
                  <Button
                    onClick={addTask}
                    disabled={isSubmitting || !title.trim()}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isSubmitting || !title.trim()
                        ? darkMode
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : darkMode 
                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>作成中...</span>
                      </span>
                    ) : (
                      '作成'
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task list */}
        <div className="space-y-4">
          {loading && tasks.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : tasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-center py-12 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
            >
              <p className="text-lg">タスクがありません</p>
              <p className="mt-2">新しいタスクを追加してみましょう！</p>
            </motion.div>
          ) : filteredAndSortedTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-center py-12 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
            >
              <p className="text-lg">検索条件に一致するタスクがありません</p>
            </motion.div>
          ) : groupByCategory ? (
            <AnimatePresence>
              {Object.entries(groupedTasks).map(([categoryName, categoryTasks]) => (
                <motion.div
                  key={categoryName}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`glass rounded-lg p-3 sm:p-4 mb-4 ${
                    darkMode ? 'bg-gray-800/50' : 'bg-white/70'
                  }`}
                >
                  {categoryName && (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleCategory(categoryName)}
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
                            <ChevronRight className="h-4 w-4 text-gray-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-600" />
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
                                      handleCategoryUpdate(categoryName, editCategoryName)
                                    } else if (e.key === 'Escape') {
                                      setEditingCategory(null)
                                    }
                                  }}
                                  onBlur={() => handleCategoryUpdate(categoryName, editCategoryName)}
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
                                  ? 'text-gray-200 hover:text-gray-100 hover:bg-gray-700' 
                                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                              }`}
                              title="カテゴリー名を編集"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleShareCategory(categoryName)}
                              className={`p-1 rounded transition-colors ${
                                copiedCategoryName === categoryName
                                  ? darkMode ? 'text-green-400' : 'text-green-600'
                                  : darkMode 
                                    ? 'text-gray-200 hover:text-blue-400 hover:bg-gray-700' 
                                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                              }`}
                              title={copiedCategoryName === categoryName ? "URLをコピーしました！" : "カテゴリーを共有"}
                            >
                              {copiedCategoryName === categoryName ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Share2 className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteCategory(categoryName)}
                              className={`p-1 rounded transition-colors ${
                                darkMode 
                                  ? 'text-gray-300 hover:text-red-400 hover:bg-gray-700' 
                                  : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
                              }`}
                              title="カテゴリーを削除"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                  )}
                  {!collapsedCategories.has(categoryName) && (
                    <div className="mt-4 space-y-3">
                          {categoryTasks.map((task, index) => {
                      const daysUntilDue = getDaysUntilDue(task.dueDate || null)
                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.05 }}
                          className={`p-4 sm:p-6 rounded-xl border task-card group ${
                            darkMode 
                              ? 'bg-gray-800/70 border-gray-700/50 backdrop-blur-sm' 
                              : 'bg-white/95 border-gray-200/70 backdrop-blur-sm shadow-sm'
                          } ${
                            task.completed ? 'opacity-60' : ''
                          } ${
                            task.priority === PRIORITY.HIGH ? 'priority-high' :
                            task.priority === PRIORITY.MEDIUM ? 'priority-medium' : 'priority-low'
                          }`}
                        >
                          <div className="flex items-start space-x-3 sm:space-x-4">
                            <button
                              onClick={() => toggleTask(task.id)}
                              className={`mt-1 transition-colors flex-shrink-0 ${
                                task.completed 
                                  ? 'text-green-500' 
                                  : darkMode ? 'text-gray-300 hover:text-green-400' : 'text-gray-500 hover:text-green-600'
                              }`}
                            >
                              {task.completed ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <Circle className="h-5 w-5" />
                              )}
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <div className="mb-2">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <Link 
                                    href={`/tasks/${task.id}`}
                                    className="flex-1 min-w-0"
                                  >
                                    <h3
                                      className={`font-semibold text-base sm:text-lg break-words cursor-pointer transition-all ${
                                        task.completed 
                                          ? darkMode ? 'text-gray-400 line-through' : 'text-gray-500 line-through'
                                          : darkMode ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'
                                      } hover:underline`}
                                    >
                                      {task.title}
                                    </h3>
                                  </Link>
                                  <span
                                    className={`px-2 py-1 text-xs font-medium rounded-full border flex-shrink-0 ${getPriorityColor(task.priority)}`}
                                  >
                                    {task.priority === PRIORITY.HIGH ? '高' : task.priority === PRIORITY.MEDIUM ? '中' : '低'}
                                  </span>
                                </div>
                                {!groupByCategory && task.category && (
                                  <span
                                    className={`inline-block px-2 py-1 text-xs font-medium rounded-md ${
                                      darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'
                                    }`}
                                  >
                                    📁 {task.category}
                                  </span>
                                )}
                                {/* 共有情報の表示 */}
                                {task.importedFromUser && (
                                  <div className="mt-1">
                                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                      📥 {task.importedFromUser.name || task.importedFromUser.email} さんから共有されたタスク
                                    </span>
                                  </div>
                                )}
                                {task.sharedWith && task.sharedWith.length > 0 && (
                                  <div className="mt-1">
                                    <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                      🔗 {task.sharedWith.length}人と共有中
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              {task.description && (
                                <p
                                  className={`text-sm mb-3 ${
                                    task.completed 
                                      ? darkMode ? 'text-gray-400' : 'text-gray-500'
                                      : darkMode ? 'text-gray-200' : 'text-gray-700'
                                  }`}
                                >
                                  {task.description}
                                </p>
                              )}
                              
                              <div className={`flex flex-wrap items-center gap-3 sm:gap-4 text-xs ${
                                darkMode ? 'text-gray-300' : 'text-gray-600'
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
                            
                            <div className="flex items-center space-x-2">
                              {/* スレッドボタン */}
                              <button
                                onClick={() => {
                                  // Mark messages as read
                                  const newReadCounts = { ...readMessageCounts, [task.id]: task._count?.threadMessages || 0 }
                                  setReadMessageCounts(newReadCounts)
                                  localStorage.setItem('readMessageCounts', JSON.stringify(newReadCounts))
                                  router.push(`/tasks/${task.id}`)
                                }}
                                className={`opacity-100 p-2 rounded-lg transition-all flex-shrink-0 relative ${
                                  darkMode 
                                    ? 'text-gray-300 hover:text-indigo-400 hover:bg-gray-700' 
                                    : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-100'
                                }`}
                                title="スレッドを表示"
                              >
                                <MessageSquare className="h-4 w-4" />
                                {task._count && task._count.threadMessages > 0 && 
                                 task._count.threadMessages > (readMessageCounts[task.id] || 0) && (
                                  <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                    {task._count.threadMessages - (readMessageCounts[task.id] || 0)}
                                  </span>
                                )}
                              </button>

                              {/* 共有ボタン */}
                              {!shareUrls[task.id] && !task.shareId ? (
                                <button
                                  onClick={() => handleShareTask(task.id)}
                                  disabled={sharingTaskId === task.id || !!task.importedFromTaskId}
                                  className={`opacity-100 p-2 rounded-lg transition-all flex-shrink-0 hover:share-glow ${
                                    task.importedFromTaskId
                                      ? 'opacity-50 cursor-not-allowed'
                                      : darkMode 
                                      ? 'text-gray-300 hover:text-blue-400 hover:bg-gray-700' 
                                      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                                  } ${sharingTaskId === task.id ? 'animate-pulse' : ''}`}
                                  title={task.importedFromTaskId ? "インポートされたタスクは共有できません" : "タスクを共有"}
                                >
                                  <Share2 className="h-4 w-4" />
                                </button>
                              ) : (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleCopyShareUrl(task.id, shareUrls[task.id] || (task.shareId ? `${window.location.origin}/shared/task/${task.shareId}` : ''))}
                                    className={`p-2 rounded-lg transition-all ${
                                      darkMode 
                                        ? 'text-blue-400 hover:bg-gray-700' 
                                        : 'text-blue-500 hover:bg-gray-100'
                                    }`}
                                    title="共有URLをコピー"
                                  >
                                    {copiedTaskId === task.id ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => unshareTask(task.id)}
                                    className={`p-1 rounded transition-all text-xs ${
                                      darkMode 
                                        ? 'text-gray-300 hover:text-gray-100' 
                                        : 'text-gray-600 hover:text-gray-800'
                                    }`}
                                    title="共有を解除"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}

                              {/* 削除ボタン */}
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                disabled={deletingTasks.has(task.id)}
                                className={`opacity-100 p-2 rounded-lg transition-all flex-shrink-0 ${
                                  deletingTasks.has(task.id)
                                    ? darkMode
                                      ? 'text-gray-500 cursor-not-allowed'
                                      : 'text-gray-400 cursor-not-allowed'
                                    : darkMode 
                                      ? 'text-gray-300 hover:text-red-400 hover:bg-gray-700' 
                                      : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
                                }`}
                              >
                                {deletingTasks.has(task.id) ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <AnimatePresence>
              {filteredAndSortedTasks.map((task, index) => {
                const daysUntilDue = getDaysUntilDue(task.dueDate || null)
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 sm:p-6 rounded-xl border task-card group ${
                      darkMode 
                        ? 'bg-gray-800/70 border-gray-700/50 backdrop-blur-sm' 
                        : 'bg-white/95 border-gray-200/70 backdrop-blur-sm shadow-sm'
                    } ${
                      task.completed ? 'opacity-60' : ''
                    } ${
                      task.priority === 'HIGH' ? 'priority-high' :
                      task.priority === 'MEDIUM' ? 'priority-medium' : 'priority-low'
                    }`}
                  >
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`mt-1 transition-colors flex-shrink-0 ${
                          task.completed 
                            ? 'text-green-500' 
                            : darkMode ? 'text-gray-300 hover:text-green-400' : 'text-gray-500 hover:text-green-600'
                        }`}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="mb-2">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <Link 
                              href={`/tasks/${task.id}`}
                              className="flex-1 min-w-0"
                            >
                              <h3
                                className={`font-semibold text-base sm:text-lg break-words cursor-pointer transition-all ${
                                  task.completed 
                                    ? darkMode ? 'text-gray-400 line-through' : 'text-gray-500 line-through'
                                    : darkMode ? 'text-white hover:text-blue-400' : 'text-gray-900 hover:text-blue-600'
                                } hover:underline`}
                              >
                                {task.title}
                              </h3>
                            </Link>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full border flex-shrink-0 ${getPriorityColor(task.priority)}`}
                            >
                              {task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低'}
                            </span>
                          </div>
                          {!groupByCategory && task.category && (
                            <span
                              className={`inline-block px-2 py-1 text-xs font-medium rounded-md ${
                                darkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              📁 {task.category}
                            </span>
                          )}
                          {/* 共有情報の表示 */}
                          {task.importedFromUser && (
                            <div className="mt-1">
                              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                📥 {task.importedFromUser.name || task.importedFromUser.email} さんから共有されたタスク
                              </span>
                            </div>
                          )}
                          {task.sharedWith && task.sharedWith.length > 0 && (
                            <div className="mt-1">
                              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                🔗 {task.sharedWith.length}人と共有中
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {task.description && (
                          <p
                            className={`text-sm mb-3 ${
                              task.completed 
                                ? darkMode ? 'text-gray-400' : 'text-gray-500'
                                : darkMode ? 'text-gray-200' : 'text-gray-700'
                            }`}
                          >
                            {task.description}
                          </p>
                        )}
                        
                        <div className={`flex flex-wrap items-center gap-3 sm:gap-4 text-xs ${
                          darkMode ? 'text-gray-300' : 'text-gray-600'
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
                      
                      <div className="flex items-center space-x-2">
                        {/* スレッドボタン */}
                        <button
                          onClick={() => {
                            // Mark messages as read
                            const newReadCounts = { ...readMessageCounts, [task.id]: task._count?.threadMessages || 0 }
                            setReadMessageCounts(newReadCounts)
                            localStorage.setItem('readMessageCounts', JSON.stringify(newReadCounts))
                            router.push(`/tasks/${task.id}`)
                          }}
                          className={`opacity-100 p-2 rounded-lg transition-all flex-shrink-0 relative ${
                            darkMode 
                              ? 'text-gray-300 hover:text-indigo-400 hover:bg-gray-700' 
                              : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-100'
                          }`}
                          title="スレッドを表示"
                        >
                          <MessageSquare className="h-4 w-4" />
                          {task._count && task._count.threadMessages > 0 && 
                           task._count.threadMessages > (readMessageCounts[task.id] || 0) && (
                            <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {task._count.threadMessages - (readMessageCounts[task.id] || 0)}
                            </span>
                          )}
                        </button>

                        {/* 共有ボタン */}
                        {!shareUrls[task.id] ? (
                          <button
                            onClick={() => handleShareTask(task.id)}
                            disabled={sharingTaskId === task.id || !!task.importedFromTaskId}
                            className={`opacity-100 p-2 rounded-lg transition-all flex-shrink-0 hover:share-glow ${
                              task.importedFromTaskId
                                ? 'opacity-50 cursor-not-allowed'
                                : darkMode 
                                ? 'text-gray-300 hover:text-blue-400 hover:bg-gray-700' 
                                : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
                            } ${sharingTaskId === task.id ? 'animate-pulse' : ''}`}
                            title={task.importedFromTaskId ? "インポートされたタスクは共有できません" : "タスクを共有"}
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                console.log('[Share Button Click - Non-grouped] taskId:', task.id, 'shareUrls:', shareUrls, 'task.shareId:', task.shareId)
                                const shareUrl = shareUrls[task.id] || (task.shareId ? `${window.location.origin}/shared/task/${task.shareId}` : '')
                                console.log('[Share Button Click - Non-grouped] generated shareUrl:', shareUrl)
                                handleCopyShareUrl(task.id, shareUrl)
                              }}
                              className={`p-2 rounded-lg transition-all ${
                                darkMode 
                                  ? 'text-blue-400 hover:bg-gray-700' 
                                  : 'text-blue-500 hover:bg-gray-100'
                              }`}
                              title="共有URLをコピー"
                            >
                              {copiedTaskId === task.id ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => unshareTask(task.id)}
                              className={`p-1 rounded transition-all text-xs ${
                                darkMode 
                                  ? 'text-gray-300 hover:text-gray-100' 
                                  : 'text-gray-600 hover:text-gray-800'
                              }`}
                              title="共有を解除"
                            >
                              ×
                            </button>
                          </div>
                        )}

                        {/* 削除ボタン */}
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          disabled={deletingTasks.has(task.id)}
                          className={`opacity-100 p-2 rounded-lg transition-all flex-shrink-0 ${
                            deletingTasks.has(task.id)
                              ? darkMode
                                ? 'text-gray-500 cursor-not-allowed'
                                : 'text-gray-400 cursor-not-allowed'
                              : darkMode 
                                ? 'text-gray-300 hover:text-red-400 hover:bg-gray-700' 
                                : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
                          }`}
                        >
                          {deletingTasks.has(task.id) ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Stats */}
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-8 p-4 rounded-lg text-center text-sm glass fade-in ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
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

        {/* SSE Connection Indicator (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              connectionState === 'open' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : connectionState === 'connecting'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionState === 'open'
                  ? 'bg-green-500'
                  : connectionState === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
              }`} />
              <span>
                {connectionState === 'open' 
                  ? 'リアルタイム接続中'
                  : connectionState === 'connecting'
                  ? '接続中...'
                  : 'オフライン (30秒毎に自動更新)'
                }
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}