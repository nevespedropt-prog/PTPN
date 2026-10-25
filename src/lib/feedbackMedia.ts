export const VIDEO_BUCKET = 'exercise-videos'
export const VOICE_BUCKET = 'exercise-voice'
const videoTypes: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }
const audioTypes: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac' }
export function feedbackMedia(file: { type: string; size: number; name?: string }, kind: 'video' | 'audio') {
  let type = file.type.split(';')[0].trim().toLowerCase()
  if (type === 'audio/x-m4a') type = 'audio/mp4'
  if (type === 'audio/x-wav') type = 'audio/wav'
  const types = kind === 'video' ? videoTypes : audioTypes
  const max = kind === 'video' ? 20 : 5
  if (!types[type]) throw new Error(kind === 'video' ? 'Choose an MP4, MOV or WebM video.' : 'Choose an M4A, WebM, Ogg, MP3, WAV or AAC audio file.')
  if (file.size <= 0 || file.size > max * 1024 * 1024) throw new Error('Choose a non-empty file up to ' + max + ' MB.')
  return { contentType: type, extension: types[type] }
}