export const NOVEL_COLORS = ['indigo', 'rose', 'emerald', 'amber', 'violet', 'sky'] as const
export type NovelColor = typeof NOVEL_COLORS[number]

export const NOVEL_GENRES = [
  { id: 'romance',  label: '로맨스' },
  { id: 'fantasy',  label: '판타지' },
  { id: 'sf',       label: 'SF' },
  { id: 'thriller', label: '스릴러' },
  { id: 'history',  label: '역사' },
  { id: 'martial',  label: '무협' },
  { id: 'daily',    label: '일상' },
  { id: 'mystery',  label: '미스터리' },
] as const
export type NovelGenre = typeof NOVEL_GENRES[number]['id']

export interface Novel {
  id: string
  title: string
  description: string
  createdAt: Date
  updatedAt: Date
  userId: string
  episodeCount: number
  color?: NovelColor
  totalChars?: number
  lastEpisodeTitle?: string
  lastEpisodeId?: string
  tags?: NovelGenre[]
}

export interface Episode {
  id: string
  novelId: string
  title: string
  content: string
  order: number
  charCount: number
  excerpt?: string
  createdAt: Date
  updatedAt: Date
}

export interface EditorSettings {
  goalCharCount: number
}
