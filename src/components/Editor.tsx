import { useState } from 'react'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useEditor } from '@/hooks/useEditor'
import { useWordCount } from '@/hooks/useWordCount'
import { useGoal } from '@/hooks/useGoal'
import { useFindReplace } from '@/hooks/useFindReplace'
import ProgressBar from './ProgressBar'
import SpecialCharPanel from './SpecialCharPanel'
import FindReplacePanel from './FindReplacePanel'

interface Props {
  novelId: string
  episodeId: string
  initialContent: string
  userId: string
  onContentChange?: (v: string) => void
}

export default function Editor({ novelId, episodeId, initialContent, userId, onContentChange }: Props) {
  const [value, setValue] = useState(initialContent)
  const { ref, handleKeyDown: editorKeyDown, handleChange, insertAt } = useEditor(value, (v) => {
    setValue(v)
    onContentChange?.(v)
  })
  const { goal, setGoal } = useGoal(episodeId)
  const { count, countNoSpace, percent } = useWordCount(value, goal)
  const saveStatus = useAutoSave(novelId, episodeId, value, userId)
  // window Cmd+F 리스너는 useFindReplace 내부에서 등록
  const fr = useFindReplace(value, (v) => { setValue(v); onContentChange?.(v) }, ref)

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // textarea에 포커스가 있을 때 Cmd+F는 window 리스너가 처리하므로 기본 동작만 막음
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      return
    }
    editorKeyDown(e)
  }

  return (
    <div className="flex h-full flex-col">
      <ProgressBar
        count={count}
        countNoSpace={countNoSpace}
        goal={goal}
        percent={percent}
        saveStatus={saveStatus}
        onGoalChange={setGoal}
      />
      <div className="relative flex-1 overflow-hidden">
        {fr.open && (
          <FindReplacePanel
            query={fr.query}
            setQuery={fr.setQuery}
            replacement={fr.replacement}
            setReplacement={fr.setReplacement}
            matchCount={fr.matchCount}
            onFindNext={fr.findNext}
            onFindPrev={fr.findPrev}
            onReplace={fr.replaceCurrent}
            onReplaceAll={fr.replaceAll}
            onClose={fr.handleClose}
          />
        )}
        <textarea
          ref={ref}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="여기에 소설을 써보세요…"
          className="h-full w-full resize-none bg-white p-6 pb-20 text-base leading-loose text-gray-800 focus:outline-none dark:bg-gray-950 dark:text-gray-100 md:p-10 md:text-lg"
        />
      </div>
      <SpecialCharPanel onInsert={insertAt} />
    </div>
  )
}
