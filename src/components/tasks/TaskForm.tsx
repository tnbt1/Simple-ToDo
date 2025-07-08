'use client'

// import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Calendar } from 'lucide-react'
import { Button } from '../ui/button'
import { PRIORITY } from '@/constants'

interface TaskFormProps {
  showForm: boolean
  setShowForm: (show: boolean) => void
  title: string
  setTitle: (title: string) => void
  description: string
  setDescription: (description: string) => void
  dueDate: string
  setDueDate: (date: string) => void
  priority: typeof PRIORITY[keyof typeof PRIORITY]
  setPriority: (priority: typeof PRIORITY[keyof typeof PRIORITY]) => void
  category: string
  setCategory: (category: string) => void
  newCategory: string
  setNewCategory: (category: string) => void
  showNewCategoryInput: boolean
  setShowNewCategoryInput: (show: boolean) => void
  isSubmitting: boolean
  categories: string[]
  darkMode: boolean
  onSubmit: () => Promise<void>
  error: string | null
}

export default function TaskForm({
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
  categories,
  darkMode,
  onSubmit,
  error
}: TaskFormProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit()
  }

  return (
    <>
      {/* タスク追加ボタン */}
      <motion.button
        onClick={() => setShowForm(!showForm)}
        className={`w-full md:w-auto px-6 py-3 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all transform hover:scale-105 ${
          darkMode 
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700' 
            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
        } ${showForm ? 'shadow-2xl' : 'shadow-lg'}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus className={`h-5 w-5 transition-transform ${showForm ? 'rotate-45' : ''}`} />
        <span>{showForm ? 'キャンセル' : '新しいタスク'}</span>
      </motion.button>

      {/* タスク追加フォーム */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`rounded-xl shadow-2xl overflow-hidden ${
              darkMode 
                ? 'bg-gray-800/70 border border-gray-700/50' 
                : 'bg-white'
            }`}
          >
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <input
                type="text"
                placeholder="何をしますか？"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                disabled={isSubmitting}
              />
              
              <textarea
                placeholder="詳細（オプション）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                disabled={isSubmitting}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Calendar className={`absolute left-3 top-3 h-5 w-5 ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100' 
                        : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as typeof PRIORITY[keyof typeof PRIORITY])}
                  className={`px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                  disabled={isSubmitting}
                >
                  <option value={PRIORITY.LOW}>低優先度</option>
                  <option value={PRIORITY.MEDIUM}>中優先度</option>
                  <option value={PRIORITY.HIGH}>高優先度</option>
                </select>

                <div className="relative">
                  {!showNewCategoryInput ? (
                    <>
                      <select
                        value={category}
                        onChange={(e) => {
                          if (e.target.value === 'new') {
                            setShowNewCategoryInput(true)
                            setCategory('')
                          } else {
                            setCategory(e.target.value)
                          }
                        }}
                        className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100' 
                            : 'bg-gray-50 border-gray-300 text-gray-900'
                        }`}
                        disabled={isSubmitting}
                      >
                        <option value="">カテゴリーなし</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="new">+ 新しいカテゴリー</option>
                      </select>
                    </>
                  ) : (
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="新しいカテゴリー名"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className={`flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                          darkMode 
                            ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                            : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                        }`}
                        disabled={isSubmitting}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCategoryInput(false)
                          setNewCategory('')
                        }}
                        className={`px-3 py-3 rounded-lg border transition-colors ${
                          darkMode 
                            ? 'border-gray-600 text-gray-400 hover:text-gray-300' 
                            : 'border-gray-300 text-gray-600 hover:text-gray-900'
                        }`}
                        disabled={isSubmitting}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className={`w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSubmitting ? '作成中...' : 'タスクを追加'}
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}