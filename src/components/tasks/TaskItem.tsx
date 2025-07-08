'use client'

// import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Trash2,
  Share2,
  Copy,
  Check,
  MessageSquare
} from 'lucide-react'
import { formatDate, getDaysUntilDue } from '@/lib/utils'
import { PRIORITY } from '@/constants'

interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string | null
  priority: typeof PRIORITY[keyof typeof PRIORITY]
  status: string
  completed: boolean
  category?: string | null
  shareId?: string | null
  isShared?: boolean
  _count?: {
    threadMessages: number
  }
}

interface TaskItemProps {
  task: Task
  darkMode: boolean
  isDeleting: boolean
  readMessageCount: number
  shareUrl?: string
  isCopied: boolean
  isSharingTask: boolean
  onToggleComplete: (id: string) => void
  onDelete: (id: string) => void
  onShare: (id: string) => void
  onCopyShareUrl: (shareId: string, taskId: string) => void
}

export default function TaskItem({
  task,
  darkMode,
  isDeleting,
  readMessageCount,
  shareUrl,
  isCopied,
  isSharingTask,
  onToggleComplete,
  onDelete,
  onShare,
  onCopyShareUrl
}: TaskItemProps) {
  const daysUntilDue = getDaysUntilDue(task.dueDate || null)
  const unreadCount = (task._count?.threadMessages || 0) - (readMessageCount || 0)

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -2 }}
      className={`group rounded-xl shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden ${
        darkMode 
          ? 'bg-gray-800/50 border border-gray-700/50' 
          : 'bg-white border border-gray-100'
      } ${isDeleting ? 'opacity-50' : ''}`}
    >
      <div className="p-4">
        <div className="flex items-start space-x-3">
          <button
            onClick={() => onToggleComplete(task.id)}
            className={`mt-1 transition-colors ${
              task.completed 
                ? 'text-green-500 hover:text-green-600' 
                : darkMode 
                  ? 'text-gray-500 hover:text-gray-300' 
                  : 'text-gray-400 hover:text-gray-600'
            }`}
            disabled={isDeleting}
          >
            {task.completed ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            <Link href={`/tasks/${task.id}`} className="block group">
              <h3 className={`font-medium transition-colors ${
                task.completed 
                  ? darkMode ? 'text-gray-500 line-through' : 'text-gray-500 line-through'
                  : darkMode ? 'text-gray-100 group-hover:text-blue-400' : 'text-gray-900 group-hover:text-blue-600'
              }`}>
                {task.title}
              </h3>
              {task.description && (
                <p className={`mt-1 text-sm ${
                  task.completed 
                    ? darkMode ? 'text-gray-600' : 'text-gray-400'
                    : darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {task.description}
                </p>
              )}
            </Link>
            
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
                {task.priority === PRIORITY.HIGH ? '高' : task.priority === PRIORITY.MEDIUM ? '中' : '低'}
              </span>
              
              {task.dueDate && (
                <span className={`flex items-center space-x-1 ${
                  daysUntilDue !== null && daysUntilDue < 0 
                    ? 'text-red-500' 
                    : daysUntilDue !== null && daysUntilDue <= 3 
                      ? 'text-orange-500' 
                      : darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  <Calendar className="h-3 w-3" />
                  <span>{formatDate(task.dueDate)}</span>
                </span>
              )}
              
              {task.category && (
                <span className={`px-2 py-1 rounded-md ${
                  darkMode 
                    ? 'bg-blue-900/30 text-blue-300' 
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {task.category}
                </span>
              )}

              {unreadCount > 0 && (
                <Link 
                  href={`/tasks/${task.id}`}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
                    darkMode
                      ? 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  } transition-colors`}
                >
                  <MessageSquare className="h-3 w-3" />
                  <span className="font-medium">{unreadCount}</span>
                </Link>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.isShared && shareUrl ? (
              <button
                onClick={() => onCopyShareUrl(task.id, shareUrl)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
                title="共有リンクをコピー"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            ) : (
              <button
                onClick={() => onShare(task.id)}
                disabled={isSharingTask}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="タスクを共有"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
            
            <button
              onClick={() => onDelete(task.id)}
              disabled={isDeleting}
              className={`p-2 rounded-lg transition-colors ${
                darkMode 
                  ? 'hover:bg-red-900/20 text-gray-400 hover:text-red-400' 
                  : 'hover:bg-red-50 text-gray-600 hover:text-red-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="タスクを削除"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}