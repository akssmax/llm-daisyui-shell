import type { DesignDocument, PatchOp } from "../types"

export function applyPatch(doc: DesignDocument, op: PatchOp): DesignDocument {
  switch (op.op) {
    case "create_element": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((p) =>
          p.id === op.pageId ? { ...p, elements: [...p.elements, op.element] } : p,
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
                elements: p.elements.map((el) =>
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
            ? { ...p, elements: p.elements.filter((el) => el.id !== op.elementId) }
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

    case "reorder_element": {
      return {
        ...doc,
        updatedAt: new Date().toISOString(),
        pages: doc.pages.map((p) =>
          p.id === op.pageId
            ? {
                ...p,
                elements: p.elements.map((el) =>
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
