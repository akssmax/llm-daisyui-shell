import { create } from "zustand"
import { persist } from "zustand/middleware"
import { nanoid } from "nanoid"
import type { MistralModel } from "@/lib/llm-types"
import type { DesignDocument, PatchOp, Theme, ShapeKind } from "../types"
import type { DesignVariant } from "../lib/layout-intelligence/types"
import { safePageElements } from "../lib/safe-page-elements"
import { applyPatch } from "./patch-reducer"

export type ActiveTool = "select" | "hand" | "text" | "shape" | "image" | "icon"

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

type DesignState = {
  document: DesignDocument | null
  activePageId: string | null

  // In-memory only (not persisted)
  selection: SelectionState
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
  densityOverride: "low" | "medium" | "high" | null
  hierarchyOverride: "strong" | "balanced" | null
  /** Partial regeneration mode for next agent turn. */
  regenerationMode: "full" | "layout" | "style" | "typography" | null

  setDocument: (doc: DesignDocument) => void
  resetDesignChatThread: () => void
  applyPatches: (patches: PatchOp[], opts?: { clearSelection?: boolean }) => void
  setActivePage: (pageId: string) => void
  updateTheme: (theme: Partial<Theme>) => void

  selectElements: (elementIds: string[], pageId: string) => void
  clearSelection: () => void
  deleteSelectedElements: () => void
  duplicateSelectedElement: () => void
  toggleSelectedElementLock: () => void

  undo: () => void
  redo: () => void

  setActiveTool: (tool: ActiveTool) => void
  setShapeToolVariant: (shape: ShapeKind) => void
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
  applyDesignVariant: (index: number) => void
  setCanvasFitScale: (fitScale: number) => void
  requestCanvasFit: () => void
  bumpFontEpoch: () => void
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set, get) => ({
      document: null,
      activePageId: null,
      selection: { elementIds: [], pageId: null },
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
      fontEpoch: 0,
      designAgentPipelineEnabled: true,
      stylePresetId: null,
      pendingVariantLayoutIds: null,
      designVariants: null,
      activeVariantIndex: 0,
      lastLayoutId: null,
      lastCritiqueScore: null,
      densityOverride: null,
      hierarchyOverride: null,
      regenerationMode: null,

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
          pendingDesignImage: null,
          canvasFitRequestTick: get().canvasFitRequestTick + 1,
        })
      },

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
          ...(shouldClearSelection ? { selection: { elementIds: [], pageId: null } } : {}),
        }))
      },

      setActivePage: (pageId) => set({ activePageId: pageId, selection: { elementIds: [], pageId: null } }),

      updateTheme: (theme) => {
        const current = get().document
        if (!current) return
        set((state) => ({
          past: [...state.past.slice(-49), current],
          future: [],
          document: { ...current, theme: { ...current.theme, ...theme } },
        }))
      },

      selectElements: (elementIds, pageId) => set({ selection: { elementIds, pageId } }),

      clearSelection: () => set({ selection: { elementIds: [], pageId: null } }),

      deleteSelectedElements: () => {
        const { selection, document: doc } = get()
        if (!doc || !selection.pageId || selection.elementIds.length === 0) return
        const patches: PatchOp[] = selection.elementIds.map((id) => ({
          op: "delete_element" as const,
          pageId: selection.pageId!,
          elementId: id,
        }))
        get().applyPatches(patches)
        set({ selection: { elementIds: [], pageId: null } })
      },

      duplicateSelectedElement: () => {
        const { selection, document: doc } = get()
        if (!doc || !selection.pageId || selection.elementIds.length !== 1) return
        const page = doc.pages.find((p) => p.id === selection.pageId)
        if (!page) return
        const elements = safePageElements(page)
        const id = selection.elementIds[0]
        const el = elements.find((e) => e.id === id)
        if (!el) return
        const clone = structuredClone(el) as typeof el
        clone.id = nanoid(8)
        clone.x = el.x + 16
        clone.y = el.y + 16
        clone.zIndex = Math.max(0, ...elements.map((e) => e.zIndex)) + 1
        get().applyPatches([{ op: "create_element", pageId: page.id, element: clone }], { clearSelection: false })
        set({ selection: { elementIds: [clone.id], pageId: page.id } })
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
        })
      },

      setActiveTool: (tool) => set({ activeTool: tool }),
      setShapeToolVariant: (shape) => set({ shapeToolVariant: shape }),
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
    }),
    {
      name: "chatShell.designs.v1",
      partialize: (state) => ({
        document: state.document,
        activePageId: state.activePageId,
        designAgentPipelineEnabled: state.designAgentPipelineEnabled,
      }),
    },
  ),
)
