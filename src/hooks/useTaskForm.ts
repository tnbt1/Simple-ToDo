'use client'

import { useState } from 'react'

export function useTaskForm() {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [category, setCategory] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setDueDate('')
    setPriority('MEDIUM')
    setCategory('')
    setNewCategory('')
    setShowNewCategoryInput(false)
    setShowForm(false)
    setIsSubmitting(false)
  }

  return {
    showForm,
    setShowForm,
    title,
    setTitle,
    description,
    setDescription,
    dueDate,
    setDueDate,
    priority,
    setPriority,
    category,
    setCategory,
    newCategory,
    setNewCategory,
    showNewCategoryInput,
    setShowNewCategoryInput,
    isSubmitting,
    setIsSubmitting,
    resetForm
  }
}