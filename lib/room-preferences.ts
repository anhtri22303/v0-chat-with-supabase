const MUTED_ROOMS_KEY = 'chat-muted-rooms'

function loadMutedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(MUTED_ROOMS_KEY)
    if (raw) {
      return new Set(JSON.parse(raw) as string[])
    }
  } catch {
    // ignore
  }
  return new Set()
}

function saveMutedSet(set: Set<string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(MUTED_ROOMS_KEY, JSON.stringify(Array.from(set)))
}

export function isRoomMuted(roomId: string): boolean {
  return loadMutedSet().has(roomId)
}

export function toggleRoomMute(roomId: string): boolean {
  const set = loadMutedSet()
  if (set.has(roomId)) {
    set.delete(roomId)
    saveMutedSet(set)
    return false
  }
  set.add(roomId)
  saveMutedSet(set)
  return true
}

export function getMutedRoomIds(): string[] {
  return Array.from(loadMutedSet())
}
