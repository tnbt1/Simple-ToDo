'use client'

import { useState } from 'react'

export function useTaskSharing() {
  const [sharingTaskId, setSharingTaskId] = useState<string | null>(null)
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)

  const handleCopyShareUrl = async (taskId: string, shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedTaskId(taskId)
      setTimeout(() => setCopiedTaskId(null), 2000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
    }
  }

  const handleCopyCategoryShareUrl = async (categoryName: string, shareUrl: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      // This would need to be handled differently for categories
      // For now, we'll use a separate state in the categories hook
    } catch (error) {
      console.error('Failed to copy URL:', error)
    }
  }

  return {
    sharingTaskId,
    setSharingTaskId,
    copiedTaskId,
    setCopiedTaskId,
    handleCopyShareUrl,
    handleCopyCategoryShareUrl
  }
}