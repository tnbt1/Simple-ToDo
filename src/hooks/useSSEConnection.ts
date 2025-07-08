'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSSE } from '../lib/sse-client'

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

export function useSSEConnection(
  session: any,
  tasks: Task[],
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>,
  fetchTasks: () => Promise<void>,
  setShareUrls?: React.Dispatch<React.SetStateAction<Record<string, string>>>
) {
  const [sseConnected, setSseConnected] = useState(false)
  const [readMessageCounts, setReadMessageCounts] = useState<Record<string, number>>({})

  // Load read message counts from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('readMessageCounts')
      if (stored) {
        setReadMessageCounts(JSON.parse(stored))
      }
    }
  }, [])

  // Auto refresh every 30 seconds as fallback when SSE is disconnected
  useEffect(() => {
    if (session && !sseConnected) {
      console.log('SSE disconnected, starting auto-refresh fallback')
      const interval = setInterval(() => {
        console.log('Auto-refreshing tasks (SSE fallback)')
        fetchTasks()
      }, 30000) // 30 seconds to reduce server load
      
      return () => {
        console.log('Stopping auto-refresh fallback')
        clearInterval(interval)
      }
    }
  }, [session, sseConnected, fetchTasks])

  const handleSSEMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      console.log('Received SSE message:', data)
      
      switch (data.type) {
        case 'task-created':
          // 自分が作成したタスクは既にローカルに追加されているので、
          // 他のユーザーが作成したタスクのみ追加する
          setTasks(prevTasks => {
            const exists = prevTasks.some(task => task.id === data.task.id)
            if (exists) {
              console.log('Task already exists, skipping:', data.task.id)
              return prevTasks
            }
            console.log('Adding new task from SSE:', data.task.id)
            return [...prevTasks, data.task]
          })
          break
        
        case 'task-updated':
          setTasks(prevTasks => 
            prevTasks.map(task => {
              if (task.id === data.task.id) {
                // 既存のカウント情報を保持しながら更新
                return {
                  ...data.task,
                  _count: task._count || data.task._count // 既存のカウントを優先的に保持
                }
              }
              return task
            })
          )
          // Update shareUrls if task has shareId
          if (data.task.shareId && setShareUrls) {
            setShareUrls(prev => ({
              ...prev,
              [data.task.id]: `${window.location.origin}/shared/task/${data.task.shareId}`
            }))
          }
          break
        
        case 'task-deleted':
          setTasks(prevTasks => 
            prevTasks.filter(task => task.id !== data.taskId)
          )
          break
          
        case 'thread-message-added':
          // Update task message count when new thread message arrives
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === data.taskId 
                ? { ...task, _count: { ...task._count, threadMessages: (task._count?.threadMessages || 0) + 1 } }
                : task
            )
          )
          break
        
        case 'shared-task-updated':
          // Update shared task when it's modified by the owner
          setTasks(prevTasks => 
            prevTasks.map(task => {
              // インポートされたタスクの更新も考慮
              if (task.id === data.task.id || 
                  (task.importedFromTaskId && task.importedFromTaskId === data.task.id)) {
                return {
                  ...task,
                  ...data.task,
                  _count: task._count || data.task._count // カウントを保持
                }
              }
              return task
            })
          )
          // Update shareUrls if task has shareId
          if (data.task.shareId && setShareUrls) {
            setShareUrls(prev => ({
              ...prev,
              [data.task.id]: `${window.location.origin}/shared/task/${data.task.shareId}`
            }))
          }
          break
        
        case 'shared-category-task-created':
          // Add the new task from shared category to the task list
          console.log('Shared category task created, adding to list:', data.task)
          setTasks(prevTasks => {
            const exists = prevTasks.some(task => task.id === data.task.id)
            if (exists) {
              console.log('Task already exists, skipping:', data.task.id)
              return prevTasks
            }
            console.log('Adding new task from shared category:', data.task.id)
            // タスクに共有元情報を追加
            const taskWithSharedInfo = {
              ...data.task,
              importedFromUserId: data.task.userId,
              importedFromUser: data.task.user
            }
            return [...prevTasks, taskWithSharedInfo]
          })
          break
          
        case 'category-task-added':
          // New task added to a shared category (for shared category page)
          console.log('Received category-task-added event:', data)
          setTasks(prevTasks => {
            const exists = prevTasks.some(task => task.id === data.task.id)
            if (!exists) {
              console.log('Adding new task from shared category:', data.task.id)
              return [...prevTasks, data.task]
            }
            return prevTasks
          })
          break
          
        case 'category-task-updated':
          // Task updated in a shared category
          console.log('Received category-task-updated event:', data)
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === data.task.id 
                ? { ...task, ...data.task, _count: task._count || data.task._count }
                : task
            )
          )
          break
          
        case 'category-task-deleted':
          // Task deleted from a shared category
          console.log('Received category-task-deleted event:', data)
          setTasks(prevTasks => 
            prevTasks.filter(task => task.id !== data.taskId)
          )
          break
      }
    } catch (error) {
      console.error('Error handling SSE message:', error)
    }
  }, [setTasks])

  // Set up SSE connection with session check
  const sseEnabled = !!(session?.user as any)?.id && process.env.NEXT_PUBLIC_DISABLE_REALTIME_UPDATES !== 'true'
  const { connectionState } = useSSE(sseEnabled ? '/api/events' : '', {
    onMessage: handleSSEMessage,
    onOpen: () => {
      console.log('Real-time updates connected')
      setSseConnected(true)
    },
    onError: () => {
      console.log('Real-time updates disconnected')
      setSseConnected(false)
    },
    reconnectDelay: 1000,
    maxReconnectDelay: 15000, // Reduced from 30s to 15s
    maxReconnectAttempts: 20 // Increased from 10 to 20
  })

  // Debug SSE connection state
  useEffect(() => {
    console.log('SSE connection state:', connectionState)
  }, [connectionState])

  return {
    sseConnected,
    connectionState,
    readMessageCounts,
    setReadMessageCounts
  }
}