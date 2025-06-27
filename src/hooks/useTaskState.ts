'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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

export function useTaskState() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shareUrls, setShareUrls] = useState<Record<string, string>>({})
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set())

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
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const tasksData = await response.json()
        setTasks(tasksData)
        
        // Build shareUrls from tasks that have shareId
        const urls: Record<string, string> = {}
        tasksData.forEach((task: Task) => {
          if (task.shareId) {
            urls[task.id] = `${window.location.origin}/shared/task/${task.shareId}`
          }
        })
        setShareUrls(urls)
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
      setError('タスクの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch tasks when session is available
  useEffect(() => {
    if (session) {
      fetchTasks()
    }
  }, [session, fetchTasks])

  return {
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
  }
}