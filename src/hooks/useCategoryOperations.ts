'use client'

import { useCallback } from 'react'

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

interface UseCategoryOperationsParams {
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  setError: (error: string | null) => void
  categoryShareUrls: Record<string, string>
  setCategoryShareUrls: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setEditingCategory: (category: string | null) => void
  setCopiedCategoryName: (name: string | null) => void
}

export function useCategoryOperations({
  tasks,
  setTasks,
  setError,
  categoryShareUrls,
  setCategoryShareUrls,
  setEditingCategory,
  setCopiedCategoryName
}: UseCategoryOperationsParams) {
  
  const handleCategoryUpdate = useCallback(async (oldCategory: string, newCategory: string) => {
    if (!newCategory.trim() || oldCategory === newCategory) {
      setEditingCategory(null)
      return
    }

    try {
      // Update all tasks with the old category to the new category
      const tasksToUpdate = tasks.filter(task => task.category === oldCategory)
      
      await Promise.all(
        tasksToUpdate.map(task =>
          fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ category: newCategory })
          })
        )
      )

      // Update local state
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.category === oldCategory
            ? { ...task, category: newCategory }
            : task
        )
      )

      setEditingCategory(null)
    } catch (error) {
      console.error('Error updating category:', error)
      setError('カテゴリの更新に失敗しました')
    }
  }, [tasks, setTasks, setError, setEditingCategory])

  const shareCategory = useCallback(async (categoryName: string) => {
    try {
      const response = await fetch('/api/categories/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: categoryName })
      })

      if (!response.ok) {
        throw new Error('カテゴリの共有に失敗しました')
      }

      const { shareUrl } = await response.json()
      setCategoryShareUrls(prev => ({ ...prev, [categoryName]: shareUrl }))
      return shareUrl
    } catch (error) {
      console.error('Error sharing category:', error)
      setError('カテゴリの共有に失敗しました')
      throw error
    }
  }, [setCategoryShareUrls, setError])

  const handleCopyCategoryShareUrl = useCallback(async (categoryName: string, shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedCategoryName(categoryName)
      setTimeout(() => setCopiedCategoryName(null), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
      setError('URLのコピーに失敗しました')
    }
  }, [setCopiedCategoryName, setError])

  return {
    handleCategoryUpdate,
    shareCategory,
    handleCopyCategoryShareUrl
  }
}