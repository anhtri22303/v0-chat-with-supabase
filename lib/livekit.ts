import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

export type CallType = 'audio' | 'video'

function getLiveKitConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const url = process.env.LIVEKIT_URL

  if (!apiKey || !apiSecret || !url) {
    throw new Error(
      'Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or LIVEKIT_URL environment variables'
    )
  }

  return { apiKey, apiSecret, url }
}

export function getLiveKitRoomName(roomType: 'dm' | 'club', roomId: string): string {
  return `${roomType}-${roomId}`
}

export async function createLiveKitToken(params: {
  identity: string
  name: string
  roomName: string
  callType: CallType
}): Promise<string> {
  const { apiKey, apiSecret } = getLiveKitConfig()

  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.identity,
    name: params.name,
    ttl: '2h',
  })

  at.addGrant({
    roomJoin: true,
    room: params.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  return await at.toJwt()
}

export async function deleteLiveKitRoom(roomName: string): Promise<void> {
  const { apiKey, apiSecret, url } = getLiveKitConfig()
  const host = url.replace('wss://', 'https://').replace('ws://', 'http://')
  const client = new RoomServiceClient(host, apiKey, apiSecret)

  try {
    await client.deleteRoom(roomName)
  } catch {
    // Room may already be closed
  }
}

export function getPublicLiveKitUrl(): string {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || ''
}
