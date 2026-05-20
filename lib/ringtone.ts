export type RingtoneHandle = {
  stop: () => void
}

export function startRingtone(volume = 0.2, soundUrl = '/ringtone.mp3'): RingtoneHandle {
  if (typeof window === 'undefined') {
    return { stop: () => {} }
  }

  const audio = new Audio(soundUrl)
  audio.loop = true
  audio.volume = Math.max(0, Math.min(1, volume))
  audio.play().catch(() => {})

  const stop = () => {
    try {
      audio.pause()
      audio.currentTime = 0
    } catch {}
  }

  return { stop }
}

export function playNotificationSound(volume = 0.5, soundUrl: string): void {
  if (typeof window === 'undefined') return
  try {
    const audio = new Audio(soundUrl)
    audio.volume = Math.max(0, Math.min(1, volume))
    audio.play().catch(() => {})
  } catch {}
}
