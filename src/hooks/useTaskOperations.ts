'use client'

import { useCallback } from 'react'
import { TIMEOUTS } from '../constants'

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

interface UseTaskOperationsParams {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  setError: (error: string | null) => void
  deletingTasks: Set<string>
  setDeletingTasks: React.Dispatch<React.SetStateAction<Set<string>>>
  shareUrls: Record<string, string>
  setShareUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

export function useTaskOperations({
  tasks,
  setTasks,
  setError,
  deletingTasks,
  setDeletingTasks,
  shareUrls,
  setShareUrls
}: UseTaskOperationsParams) {
  
  const createTask = useCallback(async (taskData: {
    title: string
    description: string
    dueDate: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    category: string
  }) => {
    // Optimistically add the task
    const tempId = `temp-${Date.now()}`
    const newTask: Task = {
      id: tempId,
      title: taskData.title,
      description: taskData.description || undefined,
      dueDate: taskData.dueDate || null,
      priority: taskData.priority,
      status: 'PENDING',
      completed: false,
      position: 0,
      tags: [],
      category: taskData.category || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setTasks(prevTasks => [...prevTasks, newTask])

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.TASK_SUBMISSION)

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('タスクの作成に失敗しました')
      }

      const createdTask = await response.json()
      
      // Replace the temporary task with the real one
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === tempId ? createdTask : task
        )
      )

      return createdTask
    } catch (error: any) {
      // Remove the temporary task on error
      setTasks(prevTasks => prevTasks.filter(task => task.id !== tempId))
      
      if (error.name === 'AbortError') {
        throw new Error('タスクの作成がタイムアウトしました。もう一度お試しください。')
      }
      throw error
    }
  }, [setTasks])

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('タスクの更新に失敗しました')
      }

      const updatedTask = await response.json()
      
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, ...updatedTask } : task
        )
      )

      return updatedTask
    } catch (error) {
      setError('タスクの更新に失敗しました')
      throw error
    }
  }, [setTasks, setError])

  const deleteTask = useCallback(async (taskId: string) => {
    setDeletingTasks(prev => new Set(prev).add(taskId))
    
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('タスクの削除に失敗しました')
      }

      setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId))
    } catch (error) {
      setError('タスクの削除に失敗しました')
      throw error
    } finally {
      setDeletingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }, [setTasks, setError, setDeletingTasks])

  const shareTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch('/api/tasks/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId })
      })

      if (!response.ok) {
        throw new Error('タスクの共有に失敗しました')
      }

      const { shareId, shareUrl } = await response.json()
      
      setShareUrls(prev => ({ ...prev, [taskId]: shareUrl }))
      
      // Update the task with the shareId
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? { ...task, shareId, isShared: true } : task
        )
      )

      return shareUrl
    } catch (error) {
      setError('タスクの共有に失敗しました')
      throw error
    }
  }, [setTasks, setShareUrls, setError])

  const toggleTaskComplete = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    await updateTask(taskId, {
      completed: !task.completed,
      status: !task.completed ? 'COMPLETED' : 'PENDING'
    })
  }, [tasks, updateTask])

  return {
    createTask,
    updateTask,
    deleteTask,
    shareTask,
    toggleTaskComplete
  }
}