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
    console.log('[Category Share URL Copy] categoryName:', categoryName, 'shareUrl:', shareUrl)
    
    if (!shareUrl) {
      console.error('[Category Share URL Copy] shareUrl is undefined for category:', categoryName)
      setError('共有URLが見つかりません。カテゴリを再度共有してください。')
      return
    }
    
    // フォールバック処理を共通化する関数
    const fallbackCopy = () => {
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        const result = document.execCommand('copy')
        if (result) {
          setCopiedCategoryName(categoryName)
          setTimeout(() => setCopiedCategoryName(null), 2000)
          console.log('[Category Share URL Copy] Successfully copied using fallback method')
          return true
        } else {
          console.error('[Category Share URL Copy] document.execCommand returned false')
          return false
        }
      } catch (err) {
        console.error('[Category Share URL Copy] Failed to copy using fallback:', err)
        return false
      } finally {
        document.body.removeChild(textArea)
      }
    }
    
    try {
      // Clipboard APIが使えるか確認し、使える場合は試す
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl)
          setCopiedCategoryName(categoryName)
          setTimeout(() => setCopiedCategoryName(null), 2000)
          console.log('[Category Share URL Copy] Successfully copied using Clipboard API')
        } catch (clipboardError) {
          // Clipboard APIが失敗した場合はフォールバックを使用
          console.error('[Category Share URL Copy] Clipboard API failed, trying fallback:', clipboardError)
          const success = fallbackCopy()
          if (!success) {
            // HTTP環境の場合は特別なメッセージを表示
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
              setError('共有URLをコピーできませんでした。HTTP環境ではセキュリティ制限があります。URLを手動で選択してコピーしてください。')
            } else {
              setError('共有URLのコピーに失敗しました。')
            }
          }
        }
      } else {
        // Clipboard APIが使えない場合は直接フォールバックを使用
        console.log('[Category Share URL Copy] Clipboard API not available, using fallback')
        const success = fallbackCopy()
        if (!success) {
          setError('共有URLのコピーに失敗しました。URLを手動で選択してコピーしてください。')
        }
      }
    } catch (error) {
      console.error('[Category Share URL Copy] Unexpected error:', error)
      setError('共有URLのコピーに失敗しました。')
    }
  }, [setCopiedCategoryName, setError])

  return {
    handleCategoryUpdate,
    shareCategory,
    handleCopyCategoryShareUrl
  }
}