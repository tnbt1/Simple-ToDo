'use client'

import { useState, useMemo } from 'react'
import { PRIORITY, TASK_STATUS } from '@/constants'

interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string | null
  priority: typeof PRIORITY[keyof typeof PRIORITY]
  status: typeof TASK_STATUS[keyof typeof TASK_STATUS]
  completed: boolean
  position: number
  tags: string[]
  category?: string | null
  createdAt: string
  updatedAt: string
  shareId?: string | null
  isShared?: boolean
  _count?: {
    threadMessages: number
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

export function useTaskFilters(tasks: Task[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all')
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'title' | 'createdAt'>('dueDate')
  const [groupByCategory, setGroupByCategory] = useState(true)

  const filteredAndSortedTasks = useMemo(() => {
    // Filter tasks
    let filtered = tasks.filter(task => {
      const matchesSearch = searchQuery === '' || 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = filterStatus === 'all' ||
        (filterStatus === 'completed' && task.completed) ||
        (filterStatus === 'pending' && !task.completed)
      
      return matchesSearch && matchesStatus
    })

    // Sort tasks
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        case 'priority':
          const priorityOrder = { [PRIORITY.HIGH]: 0, [PRIORITY.MEDIUM]: 1, [PRIORITY.LOW]: 2 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        case 'title':
          return a.title.localeCompare(b.title)
        case 'createdAt':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [tasks, searchQuery, filterStatus, sortBy])

  return {
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    sortBy,
    setSortBy,
    groupByCategory,
    setGroupByCategory,
    filteredAndSortedTasks
  }
}