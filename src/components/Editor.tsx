import { useState } from 'react'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useEditor } from '@/hooks/useEditor'
import { useWordCount } from '@/hooks/useWordCount'
import { useGoal } from '@/hooks/useGoal'
import ProgressBar from './ProgressBar'
import SpecialCharPanel from './SpecialCharPanel'

interface Props {
  novelId: string
  episodeId: string
  initialContent: string
  userId: string
}

export default function Editor({ novelId, episodeId, initialContent, userId }: Props) {
  const [value, setValue] = useState(initialContent)
  const { ref, handleKeyDown, handleChange, insertAt } = useEditor(value, setValue)
  const { goal, setGoal } = useGoal(episodeId)
  const { count, percent } = useWordCount(value, goal)
  const saveStatus = useAutoSave(novelId, episodeId, value, userId)

  return (
    <div className="flex h-full flex-col">
      <ProgressBar
        count={count}
        goal={goal}
        percent={percent}
        saveStatus={saveStatus}
        onGoalChange={setGoal}
      />
      <div className="relative flex-1 overflow-hidden">
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
