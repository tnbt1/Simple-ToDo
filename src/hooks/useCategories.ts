'use client'

import { useState, useEffect } from 'react'

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

export function useCategories(tasks: Task[]) {
  const [categories, setCategories] = useState<string[]>([])
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [categoryShareUrls, setCategoryShareUrls] = useState<Record<string, string>>({})
  const [copiedCategoryName, setCopiedCategoryName] = useState<string | null>(null)

  // Extract unique categories when tasks change
  useEffect(() => {
    const uniqueCategories = [...new Set(tasks.filter(task => task.category).map(task => task.category!))]
    setCategories(uniqueCategories)
  }, [tasks])

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  return {
    categories,
    setCategories,
    collapsedCategories,
    setCollapsedCategories,
    editingCategory,
    setEditingCategory,
    editCategoryName,
    setEditCategoryName,
    categoryShareUrls,
    setCategoryShareUrls,
    copiedCategoryName,
    setCopiedCategoryName,
    toggleCategory
  }
}