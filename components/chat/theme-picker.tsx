'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Check, ImageIcon, Loader2, Palette, Upload, X, Sliders } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'

// Extended theme colors (28 colors)
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
  { name: 'Crimson', value: '#DC143C', gradient: 'from-red-600 to-red-700' },
  { name: 'Orange Red', value: '#FF4500', gradient: 'from-orange-600 to-red-500' },
  { name: 'Gold', value: '#DAA520', gradient: 'from-yellow-500 to-amber-600' },
  { name: 'Forest Green', value: '#228B22', gradient: 'from-green-600 to-green-700' },
  { name: 'Dark Cyan', value: '#008B8B', gradient: 'from-cyan-600 to-cyan-700' },
  { name: 'Midnight Blue', value: '#191970', gradient: 'from-blue-800 to-blue-900' },
  { name: 'Purple Alt', value: '#800080', gradient: 'from-purple-600 to-purple-700' },
  { name: 'Violet Red', value: '#C71585', gradient: 'from-pink-700 to-purple-600' },
  { name: 'Tomato', value: '#FF6347', gradient: 'from-red-400 to-orange-500' },
  { name: 'Turquoise', value: '#40E0D0', gradient: 'from-teal-400 to-cyan-400' },
  { name: 'Spring Green', value: '#00FA9A', gradient: 'from-green-400 to-emerald-400' },
  { name: 'Khaki', value: '#F0E68C', gradient: 'from-yellow-300 to-amber-300' },
  { name: 'Plum', value: '#DDA0DD', gradient: 'from-purple-300 to-pink-300' },
  { name: 'Rosy Brown', value: '#BC8F8F', gradient: 'from-rose-400 to-red-300' },
  { name: 'Slate Gray', value: '#708090', gradient: 'from-slate-500 to-slate-600' },
  { name: 'Dark Slate', value: '#2F4F4F', gradient: 'from-slate-700 to-gray-700' },
] as const

export type BackgroundType = 'default' | 'color' | 'image'

export type ThemeColor = typeof THEME_COLORS[number]['value']

export interface ThemeSettings {
  themeColor: string
  backgroundType: BackgroundType
  backgroundValue: string | null
  backgroundOpacity: number
}

interface ThemePickerProps {
  currentColor: string
  currentBackground?: ThemeSettings
  onSelect: (settings: ThemeSettings) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThemePicker({
  currentColor,
  currentBackground,
  onSelect,
  open,
  onOpenChange,
}: ThemePickerProps) {
  const t = useTranslations('chatDetails')
  const [selectedColor, setSelectedColor] = useState(currentColor)
  const [backgroundType, setBackgroundType] = useState<BackgroundType>(currentBackground?.backgroundType || 'default')
  const [backgroundValue, setBackgroundValue] = useState(currentBackground?.backgroundValue || '')
  const [backgroundOpacity, setBackgroundOpacity] = useState(currentBackground?.backgroundOpacity ?? 1.0)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelectColor = (color: string) => {
    setSelectedColor(color)
  }

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Reset input so the same file can be picked again after errors
      if (e.target) e.target.value = ''
      if (!file) return

      if (!file.type.startsWith('image/')) {
        toast.error(t('uploadFailed'))
        return
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('maxSize'))
        return
      }

      // Show local preview immediately while upload is in flight
      const localPreview = URL.createObjectURL(file)
      setUploadedImage(localPreview)

      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload/background', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.error || 'Upload failed')
        }

        const { url } = (await response.json()) as { url: string; path: string }
        setUploadedImage(url)
        setBackgroundValue(url)
      } catch (err) {
        console.error('[ThemePicker] background upload failed:', err)
        toast.error(t('uploadFailed'))
        setUploadedImage(null)
        setBackgroundValue('')
      } finally {
        URL.revokeObjectURL(localPreview)
        setIsUploading(false)
      }
    },
    [t]
  )

  const handleSave = async () => {
    if (isUploading) return
    setIsSaving(true)
    try {
      await onSelect({
        themeColor: selectedColor,
        backgroundType,
        backgroundValue: backgroundType === 'default' ? null : backgroundValue,
        backgroundOpacity,
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  const getBackgroundStyle = () => {
    if (backgroundType === 'default') return {}
    if (backgroundType === 'color') {
      return { backgroundColor: backgroundValue || selectedColor + '20' }
    }
    if (backgroundType === 'image' && backgroundValue) {
      return {
        backgroundImage: `url(${backgroundValue})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: backgroundOpacity,
      }
    }
    return {}
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">{t('themePickerTitle')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('themePickerDescription')}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="theme" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="theme" className="gap-2">
              <Palette className="h-4 w-4" />
              {t('themeTab')}
            </TabsTrigger>
            <TabsTrigger value="background" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              {t('backgroundTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="theme" className="space-y-4">
            {/* Preview bubble */}
            <div className="flex justify-center py-4">
              <div
                className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-white text-sm shadow-sm"
                style={{ backgroundColor: selectedColor }}
              >
                {t('themePreview')}
              </div>
            </div>

            {/* Color grid */}
            <div className="grid grid-cols-7 gap-2">
              {THEME_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => handleSelectColor(color.value)}
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
                      <Check className="h-4 w-4 text-white drop-shadow-md" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="background" className="space-y-4">
            {/* Background type selection */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBackgroundType('default')}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                  backgroundType === 'default'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                )}
              >
                <div className="w-8 h-8 rounded bg-accent/10 border border-border" />
                <span className="text-xs">{t('bgDefault')}</span>
              </button>
              <button
                type="button"
                onClick={() => setBackgroundType('color')}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                  backgroundType === 'color'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                )}
              >
                <div 
                  className="w-8 h-8 rounded border"
                  style={{ backgroundColor: selectedColor + '40' }}
                />
                <span className="text-xs">{t('bgColor')}</span>
              </button>
              <button
                type="button"
                onClick={() => setBackgroundType('image')}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                  backgroundType === 'image'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                )}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-xs">{t('bgImage')}</span>
              </button>
            </div>

            {/* Background options based on type */}
            {backgroundType === 'color' && (
              <div className="space-y-3">
                <p className="text-sm font-medium">{t('selectBgColor')}</p>
                <div className="grid grid-cols-7 gap-2">
                  {THEME_COLORS.map((color) => (
                    <button
                      key={`bg-${color.value}`}
                      type="button"
                      onClick={() => setBackgroundValue(color.value + '20')}
                      className={cn(
                        'relative aspect-square rounded-full bg-gradient-to-br transition-all duration-200',
                        color.gradient,
                        backgroundValue === color.value + '20'
                          ? 'ring-2 ring-offset-2 ring-primary scale-110'
                          : 'hover:scale-105'
                      )}
                      title={color.name}
                      aria-label={color.name}
                    >
                      {backgroundValue === color.value + '20' && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white drop-shadow-md" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <input
                  type="color"
                  value={backgroundValue?.replace('20', '') || selectedColor}
                  onChange={(e) => setBackgroundValue(e.target.value + '30')}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>
            )}

            {backgroundType === 'image' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  {uploadedImage || backgroundValue ? (
                    <div className="relative">
                      <img
                        src={uploadedImage || backgroundValue || ''}
                        alt="Background preview"
                        className="w-48 h-32 object-cover rounded-lg"
                      />
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => {
                          setUploadedImage(null)
                          setBackgroundValue('')
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center gap-2 p-8 border-2 border-dashed border-border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{t('uploadImage')}</span>
                      <span className="text-xs text-muted-foreground">{t('maxSize')}</span>
                    </button>
                  )}
                </div>

                {/* Opacity slider */}
                {(uploadedImage || backgroundValue) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('opacity')}</span>
                      <span className="text-sm text-muted-foreground ml-auto">
                        {Math.round(backgroundOpacity * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[backgroundOpacity]}
                      onValueChange={(value) => setBackgroundOpacity(value[0])}
                      min={0.1}
                      max={1}
                      step={0.1}
                    />
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedColor(currentColor)
              setBackgroundType(currentBackground?.backgroundType || 'default')
              setBackgroundValue(currentBackground?.backgroundValue || '')
              setBackgroundOpacity(currentBackground?.backgroundOpacity ?? 1.0)
              setUploadedImage(null)
              onOpenChange(false)
            }}
            disabled={isSaving}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            style={{ backgroundColor: selectedColor }}
            className="text-white hover:opacity-90"
          >
            {isUploading
              ? t('uploadingImage')
              : isSaving
                ? t('saving')
                : t('saveTheme')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook to get theme settings for a room
export function useThemeColor() {
  const getThemeForRoom = useCallback(async (roomId: string, roomType: 'dm' | 'club'): Promise<ThemeSettings> => {
    try {
      const apiBase = roomType === 'club' ? `/api/club/${roomId}` : `/api/dm/rooms/${roomId}`
      const response = await fetch(`${apiBase}/theme`)
      if (!response.ok) throw new Error('Failed to fetch theme')
      const data = await response.json()
      return {
        themeColor: data.themeColor || '#0A7CFF',
        backgroundType: data.backgroundType || 'default',
        backgroundValue: data.backgroundValue || null,
        backgroundOpacity: data.backgroundOpacity ?? 1.0,
      }
    } catch {
      return {
        themeColor: '#0A7CFF',
        backgroundType: 'default',
        backgroundValue: null,
        backgroundOpacity: 1.0,
      }
    }
  }, [])

  const updateThemeForRoom = useCallback(async (
    roomId: string,
    roomType: 'dm' | 'club',
    settings: ThemeSettings
  ): Promise<boolean> => {
    try {
      const apiBase = roomType === 'club' ? `/api/club/${roomId}` : `/api/dm/rooms/${roomId}`
      const response = await fetch(`${apiBase}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeColor: settings.themeColor,
          backgroundType: settings.backgroundType,
          backgroundValue: settings.backgroundValue,
          backgroundOpacity: settings.backgroundOpacity,
        }),
      })
      return response.ok
    } catch (error) {
      console.error('Failed to update theme:', error)
      return false
    }
  }, [])

  return useMemo(() => ({ getThemeForRoom, updateThemeForRoom }), [getThemeForRoom, updateThemeForRoom])
}
