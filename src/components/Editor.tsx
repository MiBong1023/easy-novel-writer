import { useState } from 'react'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useAutoConvert } from '@/hooks/useAutoConvert'
import { useEditor } from '@/hooks/useEditor'
import { useWordCount } from '@/hooks/useWordCount'
import { useGoal } from '@/hooks/useGoal'
import { useFindReplace } from '@/hooks/useFindReplace'
import { useSpellCheck } from '@/hooks/useSpellCheck'
import type { SpellError } from '@/hooks/useSpellCheck'
import ProgressBar from './ProgressBar'
import SpecialCharPanel from './SpecialCharPanel'
import FindReplacePanel from './FindReplacePanel'
import HighlightTextarea from './HighlightTextarea'
import VersionHistoryPanel from './VersionHistoryPanel'
import SpellCheckPanel from './SpellCheckPanel'

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
  const [spellCheckOpen, setSpellCheckOpen] = useState(false)
  const { autoConvert, toggleAutoConvert } = useAutoConvert()
  const { ref, handleKeyDown: editorKeyDown, handleChange, insertAt } = useEditor(value, (v) => {
    setValue(v)
    onContentChange?.(v)
  }, autoConvert)
  const { goal, setGoal } = useGoal(episodeId)
  const { count, countNoSpace, percent } = useWordCount(value, goal)
  const saveStatus = useAutoSave(novelId, episodeId, value, userId)
  const fr = useFindReplace(value, (v) => { setValue(v); onContentChange?.(v) }, ref)
  const sc = useSpellCheck()

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

  function toggleSpellCheck() {
    if (spellCheckOpen) {
      setSpellCheckOpen(false)
      sc.reset()
    } else {
      setSpellCheckOpen(true)
      sc.check(value)
    }
  }

  function applyCorrection(error: SpellError, index: number) {
    const newValue = value.replace(error.original, error.correction)
    setValue(newValue)
    onContentChange?.(newValue)
    sc.dismissError(index)
  }

  function applyAll() {
    let newValue = value
    sc.errors.forEach((e) => {
      newValue = newValue.split(e.original).join(e.correction)
    })
    setValue(newValue)
    onContentChange?.(newValue)
    setSpellCheckOpen(false)
    sc.reset()
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
        onSpellCheck={toggleSpellCheck}
        spellCheckActive={spellCheckOpen}
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
        {spellCheckOpen && (
          <SpellCheckPanel
            checking={sc.checking}
            errors={sc.errors}
            errataCount={sc.errataCount}
            checked={sc.checked}
            apiError={sc.apiError}
            onApply={applyCorrection}
            onApplyAll={applyAll}
            onRecheck={() => sc.check(value)}
            onClose={() => { setSpellCheckOpen(false); sc.reset() }}
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
