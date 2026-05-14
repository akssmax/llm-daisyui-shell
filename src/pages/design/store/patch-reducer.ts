import type { DesignDocument, DesignPage, PatchOp } from "../types"
import { safePageElements } from "../lib/safe-page-elements"

export function applyPatch(doc: DesignDocument, op: PatchOp): DesignDocument {
  switch (op.op) {
    case "create_element": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((p) =>
          p.id === op.pageId ? { ...p, elements: [...safePageElements(p), op.element] } : p,
        ),
      }
    }

    case "update_element": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((p) =>
          p.id === op.pageId
            ? {
                ...p,
                elements: safePageElements(p).map((el) =>
                  el.id === op.elementId ? ({ ...el, ...op.patch } as typeof el) : el,
                ),
              }
            : p,
        ),
      }
    }

    case "delete_element": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((p) =>
          p.id === op.pageId
            ? { ...p, elements: safePageElements(p).filter((el) => el.id !== op.elementId) }
            : p,
        ),
      }
    }

    case "apply_theme": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        theme: { ...doc.theme, ...op.theme },
      }
    }

    case "create_page": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: [...doc.pages, op.page],
      }
    }

    case "delete_page": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.filter((p) => p.id !== op.pageId),
      }
    }

    case "update_page": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((p) =>
          p.id === op.pageId ? ({ ...p, ...op.patch } as DesignPage) : p,
        ),
      }
    }

    case "reorder_element": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((p) =>
          p.id === op.pageId
            ? {
                ...p,
                elements: safePageElements(p).map((el) =>
                  el.id === op.elementId ? { ...el, zIndex: op.zIndex } : el,
                ),
              }
            : p,
        ),
      }
    }

    default:
      return doc
  }
}

export function applyPatchesToDocument(doc: DesignDocument, patches: PatchOp[]): DesignDocument {
  return patches.reduce((acc, op) => applyPatch(acc, op), doc)
}
