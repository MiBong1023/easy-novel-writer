import { forwardRef, useRef } from 'react'

export interface Highlight {
  start: number
  end: number
  type?: string  // CSS class on <mark> — 없으면 기본 find/replace 스타일
}

interface Props {
  value: string
  highlights: Highlight[]
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>
  spellCheck?: boolean
  placeholder?: string
}

const SHARED = 'p-6 pb-20 text-base leading-loose md:p-10 md:text-lg'

function buildHtml(text: string, highlights: Highlight[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  if (!highlights.length) return esc(text)

  // start 기준 정렬, 겹치는 구간 건너뜀
  const sorted = [...highlights].sort((a, b) => a.start - b.start)
  let html = ''
  let last = 0
  for (const { start, end, type } of sorted) {
    if (start < last) continue
    html += esc(text.slice(last, start))
    const cls = type ? ` class="${type}"` : ''
    html += `<mark${cls}>${esc(text.slice(start, end))}</mark>`
    last = end
  }
  html += esc(text.slice(last))
  return html
}

const HighlightTextarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ value, highlights, ...props }, ref) => {
    const backdropRef = useRef<HTMLDivElement>(null)
    const showing = highlights.length > 0

    function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
      if (backdropRef.current) {
        backdropRef.current.style.transform =
          `translateY(-${e.currentTarget.scrollTop}px)`
      }
    }

    return (
      <div className="relative h-full w-full overflow-hidden bg-white dark:bg-gray-950">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            ref={backdropRef}
            className={`${SHARED} whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100`}
            dangerouslySetInnerHTML={{ __html: buildHtml(value, highlights) }}
          />
        </div>

        <textarea
          ref={ref}
          value={value}
          onScroll={handleScroll}
          {...props}
          className={[
            SHARED,
            'relative z-10 h-full w-full resize-none bg-transparent focus:outline-none',
            showing
              ? 'text-transparent'
              : 'text-gray-800 dark:text-gray-100',
          ].join(' ')}
          style={showing ? { caretColor: 'var(--caret-color)' } : undefined}
        />
      </div>
    )
  },
)

export default HighlightTextarea
