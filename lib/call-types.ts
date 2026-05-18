export type CallRoomType = 'dm' | 'club'
export type CallMediaType = 'audio' | 'video'
export type CallSessionStatus =
  | 'ringing'
  | 'active'
  | 'ended'
  | 'declined'
  | 'missed'

export interface CallSession {
  id: string
  room_type: CallRoomType
  room_id: string
  call_type: CallMediaType
  status: CallSessionStatus
  caller_id: string
  livekit_room: string
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface ActiveCallState {
  session: CallSession
  token: string
  serverUrl: string
  displayName?: string
  callerName?: string
}
