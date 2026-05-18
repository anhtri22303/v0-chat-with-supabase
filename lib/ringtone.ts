export type RingtoneHandle = {
  stop: () => void
}

export function startRingtone(volume = 0.2): RingtoneHandle {
  if (typeof window === 'undefined') {
    return { stop: () => {} }
  }

  const audio = new Audio('/ringtone.mp3')
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
