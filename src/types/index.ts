export const NOVEL_COLORS = ['indigo', 'rose', 'emerald', 'amber', 'violet', 'sky'] as const
export type NovelColor = typeof NOVEL_COLORS[number]

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
