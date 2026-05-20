const RINGBACK_SOUND_KEY = 'chat-ringback-sound'
const RINGTONE_KEY = 'chat-ringtone'
const NOTIFICATION_SOUND_KEY = 'chat-notification-sound'

export type RingbackSound = 'messenger' | 'tut-tut'
export type RingtoneSound = 'default' | 'iphone' | 'powerpoint'

export function getRingbackSound(): RingbackSound {
  if (typeof window === 'undefined') return 'messenger'
  try {
    const raw = localStorage.getItem(RINGBACK_SOUND_KEY)
    if (raw === 'messenger' || raw === 'tut-tut') return raw
  } catch {
    // ignore
  }
  return 'messenger'
}

export function setRingbackSound(sound: RingbackSound): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(RINGBACK_SOUND_KEY, sound)
}

export function getRingbackSoundUrl(sound: RingbackSound): string {
  switch (sound) {
    case 'messenger':
      return '/Am_thanh_khi_goi_messenger.mp3'
    case 'tut-tut':
      return '/Am_thanh_khi_goi_tut_tut.mp3'
    default:
      return '/Am_thanh_khi_goi_messenger.mp3'
  }
}

export function getRingtone(): RingtoneSound {
  if (typeof window === 'undefined') return 'default'
  try {
    const raw = localStorage.getItem(RINGTONE_KEY)
    if (raw === 'default' || raw === 'iphone' || raw === 'powerpoint') return raw
  } catch {
    // ignore
  }
  return 'default'
}

export function setRingtone(sound: RingtoneSound): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(RINGTONE_KEY, sound)
}

export function getRingtoneUrl(sound: RingtoneSound): string {
  switch (sound) {
    case 'iphone':
      return '/nhac_chuong_iphone_11_pro_max-www_tiengdong_com.mp3'
    case 'powerpoint':
      return '/nhac_chuong_powerpoint_vui_nhon.mp3'
    default:
      return '/ringtone.mp3'
  }
}

export type NotificationSound = 'default' | 'messages' | 'kids' | 'whistle'

export function getNotificationSound(): NotificationSound {
  if (typeof window === 'undefined') return 'default'
  try {
    const raw = localStorage.getItem(NOTIFICATION_SOUND_KEY)
    if (raw === 'default' || raw === 'messages' || raw === 'kids' || raw === 'whistle') return raw
  } catch {
    // ignore
  }
  return 'default'
}

export function setNotificationSound(sound: NotificationSound): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTIFICATION_SOUND_KEY, sound)
}

export function getNotificationSoundUrl(sound: NotificationSound): string | null {
  switch (sound) {
    case 'messages':
      return '/Am_thanh_messages.mp3'
    case 'kids':
      return '/Am_thanh_messenger_tieng_tre_con.mp3'
    case 'whistle':
      return '/Am_thanh_tieng_huyt_sao.mp3'
    case 'default':
    default:
      return null
  }
}
