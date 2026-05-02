import { forwardRef, useRef } from 'react'

export interface Highlight {
  start: number
  end: number
}

interface Props {
  value: string
  highlights: Highlight[]
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>
  spellCheck?: boolean
  placeholder?: string
}

// textarea와 backdrop이 공유하는 레이아웃 클래스
const SHARED = 'p-6 pb-20 text-base leading-loose md:p-10 md:text-lg'

function buildHtml(text: string, highlights: Highlight[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  if (!highlights.length) return esc(text)

  let html = ''
  let last = 0
  for (const { start, end } of highlights) {
    html += esc(text.slice(last, start))
    html += `<mark>${esc(text.slice(start, end))}</mark>`
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
        {/* 하이라이트 backdrop — textarea와 동일한 패딩/폰트 */}
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

        {/* 실제 textarea — 하이라이트 중엔 텍스트 투명 처리 */}
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
