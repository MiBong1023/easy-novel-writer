import { useState } from 'react'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useAutoConvert } from '@/hooks/useAutoConvert'
import { useEditor } from '@/hooks/useEditor'
import { useWordCount } from '@/hooks/useWordCount'
import { useGoal } from '@/hooks/useGoal'
import { useFindReplace } from '@/hooks/useFindReplace'
import ProgressBar from './ProgressBar'
import SpecialCharPanel from './SpecialCharPanel'
import FindReplacePanel from './FindReplacePanel'
import HighlightTextarea from './HighlightTextarea'
import VersionHistoryPanel from './VersionHistoryPanel'

interface Props {
  novelId: string
  episodeId: string
  initialContent: string
  userId: string
  onContentChange?: (v: string) => void
}

export default function Editor({ novelId, episodeId, initialContent, userId, onContentChange }: Props) {
  const [value, setValue] = useState(initialContent)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const { autoConvert, toggleAutoConvert } = useAutoConvert()
  const { ref, handleKeyDown: editorKeyDown, handleChange, insertAt } = useEditor(value, (v) => {
    setValue(v)
    onContentChange?.(v)
  }, autoConvert)
  const { goal, setGoal } = useGoal(episodeId)
  const { count, countNoSpace, percent } = useWordCount(value, goal)
  const saveStatus = useAutoSave(novelId, episodeId, value, userId)
  const fr = useFindReplace(value, (v) => { setValue(v); onContentChange?.(v) }, ref)

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault()
      return
    }
    editorKeyDown(e)
  }

  function handleRestore(content: string) {
    setValue(content)
    onContentChange?.(content)
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
        autoConvert={autoConvert}
        onToggleAutoConvert={toggleAutoConvert}
        onVersionHistoryOpen={() => setVersionsOpen(true)}
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
        {versionsOpen && (
          <VersionHistoryPanel
            novelId={novelId}
            episodeId={episodeId}
            userId={userId}
            onRestore={handleRestore}
            onClose={() => setVersionsOpen(false)}
          />
        )}
        <HighlightTextarea
          ref={ref}
          value={value}
          highlights={fr.open ? fr.highlights : []}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="여기에 소설을 써보세요…"
        />
      </div>
      <SpecialCharPanel onInsert={insertAt} />
    </div>
  )
}
