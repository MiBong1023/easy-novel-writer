const PREFIX = 'easy-novel-writer:'

export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function removeItem(key: string): void {
  localStorage.removeItem(PREFIX + key)
}
