'use client'

import { useState } from 'react'
import { flushSync } from 'react-dom'

export function useTaskSharing() {
  const [sharingTaskId, setSharingTaskId] = useState<string | null>(null)
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null)

  const handleCopyShareUrl = async (taskId: string, shareUrl: string) => {
    console.log('[Share URL Copy] taskId:', taskId, 'shareUrl:', shareUrl) // デバッグログ
    
    if (!shareUrl) {
      console.error('[Share URL Copy] shareUrl is undefined for task:', taskId)
      alert('共有URLが見つかりません。タスクを再度共有してください。')
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
          flushSync(() => {
            setCopiedTaskId(taskId)
          })
          setTimeout(() => {
            flushSync(() => {
              setCopiedTaskId(null)
            })
          }, 2000)
          console.log('[Share URL Copy] Successfully copied using fallback method')
          return true
        } else {
          console.error('[Share URL Copy] document.execCommand returned false')
          return false
        }
      } catch (err) {
        console.error('[Share URL Copy] Failed to copy using fallback:', err)
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
          flushSync(() => {
            setCopiedTaskId(taskId)
          })
          setTimeout(() => {
            flushSync(() => {
              setCopiedTaskId(null)
            })
          }, 2000)
          console.log('[Share URL Copy] Successfully copied using Clipboard API')
        } catch (clipboardError) {
          // Clipboard APIが失敗した場合はフォールバックを使用
          console.error('[Share URL Copy] Clipboard API failed, trying fallback:', clipboardError)
          const success = fallbackCopy()
          if (!success) {
            // HTTP環境の場合は特別なメッセージを表示
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
              alert('共有URLをコピーできませんでした。HTTP環境ではセキュリティ制限があります。URLを手動で選択してコピーしてください。')
            } else {
              alert('共有URLのコピーに失敗しました。')
            }
          }
        }
      } else {
        // Clipboard APIが使えない場合は直接フォールバックを使用
        console.log('[Share URL Copy] Clipboard API not available, using fallback')
        const success = fallbackCopy()
        if (!success) {
          alert('共有URLのコピーに失敗しました。URLを手動で選択してコピーしてください。')
        }
      }
    } catch (error) {
      console.error('[Share URL Copy] Unexpected error:', error)
      alert('共有URLのコピーに失敗しました。')
    }
  }

  const handleCopyCategoryShareUrl = async (categoryName: string, shareUrl: string) => {
    console.log('[Category Share URL Copy] categoryName:', categoryName, 'shareUrl:', shareUrl)
    
    if (!shareUrl) {
      console.error('[Category Share URL Copy] shareUrl is undefined for category:', categoryName)
      alert('共有URLが見つかりません。カテゴリを再度共有してください。')
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
          console.log('[Category Share URL Copy] Successfully copied using Clipboard API')
        } catch (clipboardError) {
          // Clipboard APIが失敗した場合はフォールバックを使用
          console.error('[Category Share URL Copy] Clipboard API failed, trying fallback:', clipboardError)
          const success = fallbackCopy()
          if (!success) {
            // HTTP環境の場合は特別なメッセージを表示
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
              alert('共有URLをコピーできませんでした。HTTP環境ではセキュリティ制限があります。URLを手動で選択してコピーしてください。')
            } else {
              alert('共有URLのコピーに失敗しました。')
            }
          }
        }
      } else {
        // Clipboard APIが使えない場合は直接フォールバックを使用
        console.log('[Category Share URL Copy] Clipboard API not available, using fallback')
        const success = fallbackCopy()
        if (!success) {
          alert('共有URLのコピーに失敗しました。URLを手動で選択してコピーしてください。')
        }
      }
    } catch (error) {
      console.error('[Category Share URL Copy] Unexpected error:', error)
      alert('共有URLのコピーに失敗しました。')
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