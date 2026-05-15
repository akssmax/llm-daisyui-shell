import { useEffect } from "react"
import { useShallow } from "zustand/react/shallow"
import { useDesignStore } from "../store/design-store"

export function isTypingFocusedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

function isMod(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey
}

export function useDesignKeyboardShortcuts() {
  const {
    document,
    selection,
    clipboard,
    isAiLoading,
    setActiveTool,
    setShapeToolVariant,
    clearSelection,
    deleteSelectedElements,
    copySelectedElements,
    pasteClipboardElements,
    cutSelectedElements,
    duplicateSelectedElements,
    selectAllOnActivePage,
    nudgeSelectedElements,
    undo,
    redo,
    past,
    future,
  } = useDesignStore(
    useShallow((s) => ({
      document: s.document,
      selection: s.selection,
      clipboard: s.clipboard,
      isAiLoading: s.isAiLoading,
      setActiveTool: s.setActiveTool,
      setShapeToolVariant: s.setShapeToolVariant,
      clearSelection: s.clearSelection,
      deleteSelectedElements: s.deleteSelectedElements,
      copySelectedElements: s.copySelectedElements,
      pasteClipboardElements: s.pasteClipboardElements,
      cutSelectedElements: s.cutSelectedElements,
      duplicateSelectedElements: s.duplicateSelectedElements,
      selectAllOnActivePage: s.selectAllOnActivePage,
      nudgeSelectedElements: s.nudgeSelectedElements,
      undo: s.undo,
      redo: s.redo,
      past: s.past,
      future: s.future,
    })),
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingFocusedTarget(e.target)) return
      if (!document || isAiLoading) return

      const mod = isMod(e)
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const hasSelection = selection.elementIds.length > 0

      if (mod) {
        if (e.altKey) return

        if (key === "z" && !e.shiftKey) {
          if (past.length === 0) return
          e.preventDefault()
          undo()
          return
        }
        if ((key === "z" && e.shiftKey) || key === "y") {
          if (future.length === 0) return
          e.preventDefault()
          redo()
          return
        }
        if (key === "c") {
          if (!hasSelection) return
          e.preventDefault()
          copySelectedElements()
          return
        }
        if (key === "v") {
          if (!clipboard?.elements.length) return
          e.preventDefault()
          pasteClipboardElements()
          return
        }
        if (key === "x") {
          if (!hasSelection) return
          e.preventDefault()
          cutSelectedElements()
          return
        }
        if (key === "d") {
          if (!hasSelection) return
          e.preventDefault()
          duplicateSelectedElements()
          return
        }
        if (key === "a") {
          e.preventDefault()
          selectAllOnActivePage()
          return
        }
        return
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (!hasSelection) return
        e.preventDefault()
        deleteSelectedElements()
        return
      }

      if (e.key === "Escape") {
        e.preventDefault()
        clearSelection()
        return
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (!hasSelection) return
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
        nudgeSelectedElements(dx, dy)
        return
      }

      if (e.code === "Space") {
        if (e.repeat) return
        e.preventDefault()
        setActiveTool("hand")
        return
      }

      if (e.shiftKey) return

      if (key === "v") {
        e.preventDefault()
        setActiveTool("select")
        return
      }
      if (key === "h") {
        e.preventDefault()
        setActiveTool("hand")
        return
      }
      if (key === "t") {
        e.preventDefault()
        setActiveTool("text")
        return
      }
      if (key === "r") {
        e.preventDefault()
        setShapeToolVariant("rectangle")
        setActiveTool("shape")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    clearSelection,
    copySelectedElements,
    cutSelectedElements,
    deleteSelectedElements,
    clipboard,
    document,
    duplicateSelectedElements,
    future.length,
    isAiLoading,
    nudgeSelectedElements,
    pasteClipboardElements,
    past.length,
    redo,
    selectAllOnActivePage,
    selection.elementIds.length,
    setActiveTool,
    setShapeToolVariant,
    undo,
  ])
}
