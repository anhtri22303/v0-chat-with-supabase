'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Messenger-style theme colors
export const THEME_COLORS = [
  { name: 'Messenger Blue', value: '#0A7CFF', gradient: 'from-blue-500 to-blue-600' },
  { name: 'Red', value: '#FF0000', gradient: 'from-red-500 to-red-600' },
  { name: 'Orange', value: '#FF8C00', gradient: 'from-orange-500 to-orange-600' },
  { name: 'Yellow', value: '#FFD700', gradient: 'from-yellow-400 to-yellow-500' },
  { name: 'Green', value: '#32CD32', gradient: 'from-green-500 to-green-600' },
  { name: 'Cyan', value: '#00CED1', gradient: 'from-cyan-500 to-cyan-600' },
  { name: 'Royal Blue', value: '#4169E1', gradient: 'from-blue-600 to-blue-700' },
  { name: 'Purple', value: '#8A2BE2', gradient: 'from-purple-500 to-purple-600' },
  { name: 'Deep Pink', value: '#FF1493', gradient: 'from-pink-600 to-pink-700' },
  { name: 'Hot Pink', value: '#FF69B4', gradient: 'from-pink-400 to-pink-500' },
  { name: 'Lavender', value: '#9370DB', gradient: 'from-violet-500 to-violet-600' },
  { name: 'Teal', value: '#20B2AA', gradient: 'from-teal-500 to-teal-600' },
] as const

export type ThemeColor = typeof THEME_COLORS[number]['value']

interface ThemePickerProps {
  currentColor: string
  onSelect: (color: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThemePicker({
  currentColor,
  onSelect,
  open,
  onOpenChange,
}: ThemePickerProps) {
  const t = useTranslations('chatDetails')
  const [selectedColor, setSelectedColor] = useState(currentColor)
  const [isSaving, setIsSaving] = useState(false)

  const handleSelect = (color: string) => {
    setSelectedColor(color)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSelect(selectedColor)
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{t('themePickerTitle')}</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {/* Preview bubble */}
          <div className="flex justify-center mb-6">
            <div
              className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-white text-sm shadow-sm"
              style={{ backgroundColor: selectedColor }}
            >
              {t('themePreview')}
            </div>
          </div>

          {/* Color grid */}
          <div className="grid grid-cols-4 gap-3">
            {THEME_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => handleSelect(color.value)}
                className={cn(
                  'relative aspect-square rounded-full bg-gradient-to-br transition-all duration-200',
                  color.gradient,
                  selectedColor === color.value
                    ? 'ring-2 ring-offset-2 ring-primary scale-110'
                    : 'hover:scale-105'
                )}
                title={color.name}
                aria-label={color.name}
              >
                {selectedColor === color.value && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Check className="h-5 w-5 text-white drop-shadow-md" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedColor(currentColor)
              onOpenChange(false)
            }}
            disabled={isSaving}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || selectedColor === currentColor}
            style={{
              backgroundColor: selectedColor,
            }}
            className="text-white hover:opacity-90"
          >
            {isSaving ? t('saving') : t('saveTheme')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook to get theme color for a room
export function useThemeColor() {
  const getThemeForRoom = async (roomId: string, roomType: 'dm' | 'club'): Promise<string> => {
    try {
      const apiBase = roomType === 'club' ? `/api/club/${roomId}` : `/api/dm/rooms/${roomId}`
      const response = await fetch(`${apiBase}/theme`)
      if (!response.ok) throw new Error('Failed to fetch theme')
      const data = await response.json()
      return data.themeColor || '#0A7CFF'
    } catch {
      return '#0A7CFF'
    }
  }

  const updateThemeForRoom = async (
    roomId: string,
    roomType: 'dm' | 'club',
    color: string
  ): Promise<boolean> => {
    try {
      const apiBase = roomType === 'club' ? `/api/club/${roomId}` : `/api/dm/rooms/${roomId}`
      const response = await fetch(`${apiBase}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeColor: color }),
      })
      return response.ok
    } catch {
      return false
    }
  }

  return { getThemeForRoom, updateThemeForRoom }
}
