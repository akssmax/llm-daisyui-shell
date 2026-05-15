import { create } from "zustand"
import { persist } from "zustand/middleware"
import { nanoid } from "nanoid"
import type { MistralModel } from "@/lib/llm-types"
import type { DesignDocument, DesignElement, PatchOp, Theme, ShapeKind } from "../types"
import type { DesignVariant } from "../lib/layout-intelligence/types"
import type { CanvasPresetMode } from "../lib/design-presets"
import type { DesignAgentOperation } from "../lib/design-agent-router"
import { REMIX_LAYOUT_USER_MESSAGE } from "../lib/design-agent-router"
import { safePageElements } from "../lib/safe-page-elements"
import { applyPatch } from "./patch-reducer"

export type ActiveTool = "select" | "hand" | "text" | "shape" | "image" | "icon" | "silhouette"

export type DesignViewport = {
  /** Multiplier applied on top of auto fit-to-container scale (1 = 100%). */
  userZoom: number
  panX: number
  panY: number
  showGrid: boolean
  snapToGrid: boolean
}

type SelectionState = {
  elementIds: string[]
  pageId: string | null
}

export type PropertiesPanelTarget = "page" | "element"

export type DesignClipboard = {
  pageId: string
  elements: DesignElement[]
}

const DUPLICATE_OFFSET = 16

type DesignState = {
  document: DesignDocument | null
  activePageId: string | null

  // In-memory only (not persisted)
  selection: SelectionState
  propertiesPanelOpen: boolean
  propertiesPanelTarget: PropertiesPanelTarget
  clipboard: DesignClipboard | null
  /** Increments on each paste so repeated pastes stack with offset. */
  clipboardPasteGeneration: number
  past: DesignDocument[]
  future: DesignDocument[]
  activeTool: ActiveTool
  isAiLoading: boolean
  viewport: DesignViewport
  /** Data URL from toolbar image pick; consumed when placed on canvas. */
  pendingDesignImage: string | null
  designChatModel: MistralModel
  /** Last fit-to-container scale from DesignCanvas (for export pixel ratio). */
  canvasFitScale: number
  /** Incremented when user clicks Fit — DesignCanvas recomputes fit scale. */
  canvasFitRequestTick: number
  /** Bumped to clear the design chat panel (new session / preset / explicit new thread). Not persisted. */
  designChatThreadNonce: number
  /** Active shape geometry when `activeTool === "shape"` (Figma-style shape picker). */
  shapeToolVariant: ShapeKind
  /** Agent avatar shape when `activeTool === "silhouette"`. */
  silhouetteToolShape: string
  /** Incremented after design fonts load so Konva text redraws with new `document.fonts`. */
  fontEpoch: number
  /** Multi-phase design agent (intent → tokens → layout → compose → validate/repair). */
  designAgentPipelineEnabled: boolean
  /** Style preset id from catalog (e.g. modern-saas-style). */
  stylePresetId: string | null
  /** Override layout ids for next variant generation. */
  pendingVariantLayoutIds: string[] | null
  /** Last generation variants for carousel picker. */
  designVariants: DesignVariant[] | null
  activeVariantIndex: number
  lastLayoutId: string | null
  lastCritiqueScore: number | null
  lastGenerationId: string | null
  lastBanditContextKey: string | null
  lastStylePresetId: string | null
  lastTokenPresetId: string | null
  densityOverride: "low" | "medium" | "high" | null
  hierarchyOverride: "strong" | "balanced" | null
  /** Partial regeneration mode for next agent turn. */
  regenerationMode: "full" | "layout" | "style" | "typography" | null
  /** Fixed preset size, or "auto" to let intent pick dimensions from the prompt. */
  canvasPresetMode: CanvasPresetMode
  /** Queued agent turn (e.g. Remix layout from canvas) — consumed by design chat panel. */
  pendingAgentTurn: { message: string; forcedOperation: DesignAgentOperation } | null

  setDocument: (doc: DesignDocument) => void
  clearDocument: () => void
  resetDesignChatThread: () => void
  applyPatches: (patches: PatchOp[], opts?: { clearSelection?: boolean }) => void
  setActivePage: (pageId: string) => void
  updateTheme: (theme: Partial<Theme>) => void

  selectElements: (elementIds: string[], pageId: string) => void
  clearSelection: () => void
  openPageProperties: () => void
  closePropertiesPanel: () => void
  deleteSelectedElements: () => void
  copySelectedElements: () => void
  pasteClipboardElements: () => void
  cutSelectedElements: () => void
  duplicateSelectedElements: () => void
  selectAllOnActivePage: () => void
  nudgeSelectedElements: (dx: number, dy: number) => void
  toggleSelectedElementLock: () => void

  undo: () => void
  redo: () => void

  setActiveTool: (tool: ActiveTool) => void
  setShapeToolVariant: (shape: ShapeKind) => void
  setSilhouetteToolShape: (shapeName: string) => void
  setAiLoading: (loading: boolean) => void
  setViewport: (partial: Partial<DesignViewport>) => void
  resetViewport: () => void
  setPendingDesignImage: (dataUrl: string | null) => void
  setDesignChatModel: (model: MistralModel) => void
  setDesignAgentPipelineEnabled: (enabled: boolean) => void
  setStylePresetId: (id: string | null) => void
  setPendingVariantLayoutIds: (ids: string[] | null) => void
  setDesignVariants: (variants: DesignVariant[] | null) => void
  setActiveVariantIndex: (index: number) => void
  setDensityOverride: (d: "low" | "medium" | "high" | null) => void
  setHierarchyOverride: (h: "strong" | "balanced" | null) => void
  setRegenerationMode: (mode: "full" | "layout" | "style" | "typography" | null) => void
  setCanvasPresetMode: (mode: CanvasPresetMode) => void
  applyDesignVariant: (index: number) => void
  setCanvasFitScale: (fitScale: number) => void
  requestCanvasFit: () => void
  bumpFontEpoch: () => void
  requestRemixLayout: () => void
  consumePendingAgentTurn: () => { message: string; forcedOperation: DesignAgentOperation } | null
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set, get) => ({
      document: null,
      activePageId: null,
      selection: { elementIds: [], pageId: null },
      propertiesPanelOpen: false,
      propertiesPanelTarget: "page",
      clipboard: null,
      clipboardPasteGeneration: 0,
      past: [],
      future: [],
      activeTool: "select",
      isAiLoading: false,
      viewport: {
        userZoom: 1,
        panX: 0,
        panY: 0,
        showGrid: false,
        snapToGrid: true,
      },
      pendingDesignImage: null,
      designChatModel: "mistral-small-latest",
      canvasFitScale: 1,
      canvasFitRequestTick: 0,
      designChatThreadNonce: 0,
      shapeToolVariant: "rectangle",
      silhouetteToolShape: "Heart",
      fontEpoch: 0,
      designAgentPipelineEnabled: true,
      stylePresetId: null,
      pendingVariantLayoutIds: null,
      designVariants: null,
      activeVariantIndex: 0,
      lastLayoutId: null,
      lastCritiqueScore: null,
      lastGenerationId: null,
      lastBanditContextKey: null,
      lastStylePresetId: null,
      lastTokenPresetId: null,
      densityOverride: null,
      hierarchyOverride: null,
      regenerationMode: null,
      canvasPresetMode: "auto",
      pendingAgentTurn: null,

      resetDesignChatThread: () =>
        set((s) => ({ designChatThreadNonce: s.designChatThreadNonce + 1 })),

      setDocument: (doc) => {
        const current = get().document
        set({
          document: doc,
          activePageId: doc.pages[0]?.id ?? null,
          past: current ? [...get().past.slice(-49), current] : get().past,
          future: [],
          selection: { elementIds: [], pageId: null },
          propertiesPanelOpen: false,
          pendingDesignImage: null,
          canvasFitRequestTick: get().canvasFitRequestTick + 1,
        })
      },

      clearDocument: () =>
        set({
          document: null,
          activePageId: null,
          selection: { elementIds: [], pageId: null },
          propertiesPanelOpen: false,
          clipboard: null,
          clipboardPasteGeneration: 0,
          past: [],
          future: [],
          pendingDesignImage: null,
          canvasFitRequestTick: get().canvasFitRequestTick + 1,
        }),

      applyPatches: (patches, opts) => {
        const shouldClearSelection = opts?.clearSelection ?? true
        const state0 = get()
        const current = state0.document
        if (!current) return

        let doc = current
        let activePageId = state0.activePageId
        for (const op of patches) {
          doc = applyPatch(doc, op)
          if (op.op === "create_page" && activePageId === null) {
            activePageId = op.page.id
          }
        }
        if (!doc.pages.find((p) => p.id === activePageId) && doc.pages.length > 0) {
          activePageId = doc.pages[0].id
        }

        set((state) => ({
          past: [...state.past.slice(-49), current],
          future: [],
          document: doc,
          activePageId,
          ...(shouldClearSelection
            ? { selection: { elementIds: [], pageId: null }, propertiesPanelOpen: false }
            : {}),
        }))
      },

      setActivePage: (pageId) =>
        set({
          activePageId: pageId,
          selection: { elementIds: [], pageId: null },
          propertiesPanelOpen: false,
        }),

      updateTheme: (theme) => {
        const current = get().document
        if (!current) return
        set((state) => ({
          past: [...state.past.slice(-49), current],
          future: [],
          document: { ...current, theme: { ...current.theme, ...theme } },
        }))
      },

      selectElements: (elementIds, pageId) => {
        if (elementIds.length === 1) {
          set({
            selection: { elementIds, pageId },
            propertiesPanelOpen: true,
            propertiesPanelTarget: "element",
          })
          return
        }
        set({
          selection: { elementIds, pageId },
          propertiesPanelOpen: false,
        })
      },

      clearSelection: () =>
        set({ selection: { elementIds: [], pageId: null }, propertiesPanelOpen: false }),

      openPageProperties: () =>
        set({
          selection: { elementIds: [], pageId: null },
          propertiesPanelOpen: true,
          propertiesPanelTarget: "page",
        }),

      closePropertiesPanel: () => set({ propertiesPanelOpen: false }),

      deleteSelectedElements: () => {
        const { selection, document: doc } = get()
        if (!doc || !selection.pageId || selection.elementIds.length === 0) return
        const patches: PatchOp[] = selection.elementIds.map((id) => ({
          op: "delete_element" as const,
          pageId: selection.pageId!,
          elementId: id,
        }))
        get().applyPatches(patches)
        set({ selection: { elementIds: [], pageId: null }, propertiesPanelOpen: false })
      },

      copySelectedElements: () => {
        const { selection, document: doc } = get()
        if (!doc || !selection.pageId || selection.elementIds.length === 0) return
        const page = doc.pages.find((p) => p.id === selection.pageId)
        if (!page) return
        const elements = safePageElements(page)
        const copied = selection.elementIds
          .map((id) => elements.find((e) => e.id === id))
          .filter((e): e is DesignElement => Boolean(e))
          .map((e) => structuredClone(e))
        if (copied.length === 0) return
        set({ clipboard: { pageId: selection.pageId, elements: copied }, clipboardPasteGeneration: 0 })
      },

      pasteClipboardElements: () => {
        const { clipboard, document: doc, activePageId, clipboardPasteGeneration } = get()
        if (!clipboard || !doc || !activePageId) return
        const page = doc.pages.find((p) => p.id === activePageId)
        if (!page) return
        const pageElements = safePageElements(page)
        const generation = clipboardPasteGeneration + 1
        const offset = DUPLICATE_OFFSET * generation
        let z = Math.max(0, ...pageElements.map((e) => e.zIndex))
        const clones: DesignElement[] = clipboard.elements.map((el) => {
          const clone = structuredClone(el) as DesignElement
          clone.id = nanoid(8)
          clone.x = el.x + offset
          clone.y = el.y + offset
          z += 1
          clone.zIndex = z
          return clone
        })
        if (clones.length === 0) return
        get().applyPatches(
          clones.map((element) => ({ op: "create_element" as const, pageId: page.id, element })),
          { clearSelection: false },
        )
        const pastedIds = clones.map((c) => c.id)
        set({ clipboardPasteGeneration: generation })
        if (pastedIds.length === 1) {
          get().selectElements(pastedIds, page.id)
        } else {
          set({ selection: { elementIds: pastedIds, pageId: page.id }, propertiesPanelOpen: false })
        }
      },

      cutSelectedElements: () => {
        get().copySelectedElements()
        get().deleteSelectedElements()
      },

      duplicateSelectedElements: () => {
        const { selection, document: doc } = get()
        if (!doc || !selection.pageId || selection.elementIds.length === 0) return
        const page = doc.pages.find((p) => p.id === selection.pageId)
        if (!page) return
        const elements = safePageElements(page)
        let z = Math.max(0, ...elements.map((e) => e.zIndex))
        const clones: DesignElement[] = []
        for (const id of selection.elementIds) {
          const el = elements.find((e) => e.id === id)
          if (!el) continue
          const clone = structuredClone(el) as DesignElement
          clone.id = nanoid(8)
          clone.x = el.x + DUPLICATE_OFFSET
          clone.y = el.y + DUPLICATE_OFFSET
          z += 1
          clone.zIndex = z
          clones.push(clone)
        }
        if (clones.length === 0) return
        get().applyPatches(
          clones.map((element) => ({ op: "create_element" as const, pageId: page.id, element })),
          { clearSelection: false },
        )
        const dupIds = clones.map((c) => c.id)
        if (dupIds.length === 1) {
          get().selectElements(dupIds, page.id)
        } else {
          set({ selection: { elementIds: dupIds, pageId: page.id }, propertiesPanelOpen: false })
        }
      },

      selectAllOnActivePage: () => {
        const { document: doc, activePageId } = get()
        if (!doc || !activePageId) return
        const page = doc.pages.find((p) => p.id === activePageId)
        if (!page) return
        const ids = safePageElements(page).map((e) => e.id)
        if (ids.length === 0) return
        set({ selection: { elementIds: ids, pageId: activePageId }, propertiesPanelOpen: false })
      },

      nudgeSelectedElements: (dx, dy) => {
        const { selection, document: doc } = get()
        if (!doc || !selection.pageId || selection.elementIds.length === 0) return
        if (dx === 0 && dy === 0) return
        const page = doc.pages.find((p) => p.id === selection.pageId)
        if (!page) return
        const elements = safePageElements(page)
        const patches: PatchOp[] = []
        for (const id of selection.elementIds) {
          const el = elements.find((e) => e.id === id)
          if (!el || el.locked) continue
          patches.push({
            op: "update_element",
            pageId: selection.pageId,
            elementId: id,
            patch: { x: el.x + dx, y: el.y + dy },
          })
        }
        if (patches.length === 0) return
        get().applyPatches(patches, { clearSelection: false })
      },

      toggleSelectedElementLock: () => {
        const { selection, document: doc } = get()
        if (!doc || !selection.pageId || selection.elementIds.length !== 1) return
        const id = selection.elementIds[0]
        const page = doc.pages.find((p) => p.id === selection.pageId)
        const el = page ? safePageElements(page).find((e) => e.id === id) : undefined
        if (!el) return
        get().applyPatches(
          [{ op: "update_element", pageId: selection.pageId!, elementId: id, patch: { locked: !el.locked } }],
          { clearSelection: false },
        )
      },

      undo: () => {
        const { past, document } = get()
        if (past.length === 0) return
        const previous = past[past.length - 1]
        set({
          document: previous,
          activePageId: previous.pages[0]?.id ?? null,
          past: past.slice(0, -1),
          future: document ? [document, ...get().future.slice(0, 49)] : get().future,
          selection: { elementIds: [], pageId: null },
          propertiesPanelOpen: false,
        })
      },

      redo: () => {
        const { future, document } = get()
        if (future.length === 0) return
        const next = future[0]
        set({
          document: next,
          activePageId: next.pages[0]?.id ?? null,
          future: future.slice(1),
          past: document ? [...get().past.slice(-49), document] : get().past,
          selection: { elementIds: [], pageId: null },
          propertiesPanelOpen: false,
        })
      },

      setActiveTool: (tool) => set({ activeTool: tool }),
      setShapeToolVariant: (shape) => set({ shapeToolVariant: shape }),
      setSilhouetteToolShape: (shapeName) => set({ silhouetteToolShape: shapeName }),
      setAiLoading: (loading) => set({ isAiLoading: loading }),
      setViewport: (partial) =>
        set((s) => ({
          viewport: { ...s.viewport, ...partial },
        })),
      resetViewport: () =>
        set({
          viewport: {
            userZoom: 1,
            panX: 0,
            panY: 0,
            showGrid: false,
            snapToGrid: true,
          },
        }),
      setPendingDesignImage: (dataUrl) => set({ pendingDesignImage: dataUrl }),
      setDesignChatModel: (model) => set({ designChatModel: model }),
      setDesignAgentPipelineEnabled: (enabled) => set({ designAgentPipelineEnabled: enabled }),
      setStylePresetId: (id) => set({ stylePresetId: id }),
      setPendingVariantLayoutIds: (ids) => set({ pendingVariantLayoutIds: ids }),
      setDesignVariants: (variants) =>
        set({ designVariants: variants, activeVariantIndex: 0 }),
      setActiveVariantIndex: (index) => set({ activeVariantIndex: index }),
      setDensityOverride: (d) => set({ densityOverride: d }),
      setHierarchyOverride: (h) => set({ hierarchyOverride: h }),
      setRegenerationMode: (mode) => set({ regenerationMode: mode }),
      setCanvasPresetMode: (mode) => set({ canvasPresetMode: mode }),
      applyDesignVariant: (index) => {
        const variants = get().designVariants
        if (!variants || index < 0 || index >= variants.length) return
        const v = variants[index]!
        set({
          document: v.document,
          activeVariantIndex: index,
          lastLayoutId: v.layoutId,
          lastCritiqueScore: v.critique.compositeScore,
          canvasFitRequestTick: get().canvasFitRequestTick + 1,
        })
      },
      setCanvasFitScale: (fitScale) => set({ canvasFitScale: fitScale }),
      requestCanvasFit: () =>
        set((s) => ({ canvasFitRequestTick: s.canvasFitRequestTick + 1 })),
      bumpFontEpoch: () => set((s) => ({ fontEpoch: s.fontEpoch + 1 })),

      requestRemixLayout: () => {
        if (!get().document) return
        set({
          pendingAgentTurn: {
            message: REMIX_LAYOUT_USER_MESSAGE,
            forcedOperation: "design_recompose_layout",
          },
        })
      },

      consumePendingAgentTurn: () => {
        const pending = get().pendingAgentTurn
        if (!pending) return null
        set({ pendingAgentTurn: null })
        return pending
      },
    }),
    {
      name: "chatShell.designs.v1",
      partialize: (state) => ({
        document: state.document,
        activePageId: state.activePageId,
        designAgentPipelineEnabled: state.designAgentPipelineEnabled,
        canvasPresetMode: state.canvasPresetMode,
      }),
    },
  ),
)
