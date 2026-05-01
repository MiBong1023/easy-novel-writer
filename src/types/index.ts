export interface Novel {
  id: string
  title: string
  description: string
  createdAt: Date
  updatedAt: Date
  userId: string
  episodeCount: number
}

export interface Episode {
  id: string
  novelId: string
  title: string
  content: string
  order: number
  charCount: number
  createdAt: Date
  updatedAt: Date
}

export interface EditorSettings {
  goalCharCount: number
}
