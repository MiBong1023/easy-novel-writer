import { useState } from 'react'

const SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl'] as const
type FontSize = typeof SIZES[number]

const DEFAULT: FontSize = 'text-base'

export function useEditorSettings() {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const v = localStorage.getItem('editorFontSize') as FontSize
    return SIZES.includes(v) ? v : DEFAULT
  })

  function increase() {
    setFontSize((prev) => {
      const next = SIZES[Math.min(SIZES.indexOf(prev) + 1, SIZES.length - 1)]
      localStorage.setItem('editorFontSize', next)
      return next
    })
  }

  function decrease() {
    setFontSize((prev) => {
      const next = SIZES[Math.max(SIZES.indexOf(prev) - 1, 0)]
      localStorage.setItem('editorFontSize', next)
      return next
    })
  }

  return {
    fontSize,
    increase,
    decrease,
    canIncrease: fontSize !== SIZES[SIZES.length - 1],
    canDecrease: fontSize !== SIZES[0],
  }
}
