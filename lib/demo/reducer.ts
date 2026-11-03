// Every change to the demo store. Edits go to a fixture's draft (started on
// the first change, with Undo); publishing makes the draft what everyone sees.
// Quick Adjust changes the published planogram directly, marked as adjusted.
// A move the grid refuses leaves the state as it was; screens explain why.

import { checkSpot, firstFit, sizeFor } from "./grid";
import type { DemoState, Placement, Presentation, Role, Status } from "./types";
import { faceOf, fixtureOf } from "./words";

export type DemoAction =
  | { type: "role"; role: Role }
  | { type: "status"; productId: string; status: Status }
  | { type: "move"; placementId: string; fixtureId: string; faceId: string; col: number; row: number }
  | { type: "add"; fixtureId: string; faceId: string; productId: string; presentation: Presentation }
  | { type: "remove"; fixtureId: string; placementId: string }
  | { type: "undo"; fixtureId: string }
  | { type: "publish"; fixtureId: string }
  | { type: "discard"; fixtureId: string }
  | { type: "adjust"; placementId: string; productId: string }
  | { type: "reset"; state: DemoState };

/** The placements a fixture shows while editing: its draft, else what's published. */
export function working(state: DemoState, fixtureId: string): Placement[] {
  return state.drafts[fixtureId] ?? state.published.filter((p) => p.fixtureId === fixtureId);
}

function withDraft(state: DemoState, fixtureId: string, next: Placement[]): DemoState {
  const before = working(state, fixtureId);
  return {
    ...state,
    drafts: { ...state.drafts, [fixtureId]: next },
    undo: { ...state.undo, [fixtureId]: [...(state.undo[fixtureId] ?? []), before] },
  };
}

function clearDraft(state: DemoState, fixtureId: string): Pick<DemoState, "drafts" | "undo"> {
  const drafts = { ...state.drafts };
  const undo = { ...state.undo };
  delete drafts[fixtureId];
  delete undo[fixtureId];
  return { drafts, undo };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "reset":
      return action.state;
    case "role":
      return { ...state, role: action.role };
    case "status":
      return { ...state, products: state.products.map((p) => (p.id === action.productId ? { ...p, status: action.status } : p)) };
    case "move": {
      const placements = working(state, action.fixtureId);
      const moving = placements.find((p) => p.id === action.placementId);
      if (!moving) return state;
      const fixture = fixtureOf(action.fixtureId);
      const face = fixture.faces.find((f) => f.id === action.faceId);
      if (!face) return state;
      const spot = { faceId: face.id, col: action.col, row: action.row, w: moving.w, h: moving.h };
      const others = placements.filter((p) => p.id !== moving.id);
      if (!checkSpot(face, others, spot).ok) return state;
      return withDraft(state, action.fixtureId, placements.map((p) => (p.id === moving.id ? { ...p, ...spot } : p)));
    }
    case "add": {
      const product = state.products.find((p) => p.id === action.productId);
      if (!product) return state;
      const placements = working(state, action.fixtureId);
      const face = faceOf({ fixtureId: action.fixtureId, faceId: action.faceId });
      const spot = firstFit(face, placements, sizeFor(product, action.presentation));
      if (!spot) return state;
      const added: Placement = { id: `pl-${state.nextId}`, productId: product.id, fixtureId: action.fixtureId, presentation: action.presentation, ...spot };
      return { ...withDraft(state, action.fixtureId, [...placements, added]), nextId: state.nextId + 1 };
    }
    case "remove":
      return withDraft(state, action.fixtureId, working(state, action.fixtureId).filter((p) => p.id !== action.placementId));
    case "undo": {
      const steps = state.undo[action.fixtureId] ?? [];
      if (steps.length === 0) return state;
      const previous = steps[steps.length - 1];
      const rest = steps.slice(0, -1);
      // Undoing every change leaves no draft behind.
      if (rest.length === 0) return { ...state, ...clearDraft(state, action.fixtureId) };
      return { ...state, drafts: { ...state.drafts, [action.fixtureId]: previous }, undo: { ...state.undo, [action.fixtureId]: rest } };
    }
    case "publish": {
      const draft = state.drafts[action.fixtureId];
      if (!draft) return state;
      return {
        ...state,
        ...clearDraft(state, action.fixtureId),
        // A newly published planogram replaces any Quick Adjust on it.
        published: [...state.published.filter((p) => p.fixtureId !== action.fixtureId), ...draft.map((p) => ({ ...p, adjusted: false }))],
        versions: { ...state.versions, [action.fixtureId]: (state.versions[action.fixtureId] ?? 0) + 1 },
      };
    }
    case "discard":
      return { ...state, ...clearDraft(state, action.fixtureId) };
    case "adjust": {
      const gap = state.published.find((p) => p.id === action.placementId);
      const product = state.products.find((p) => p.id === action.productId);
      if (!gap || !product) return state;
      const size = sizeFor(product, gap.presentation);
      const spot = { faceId: gap.faceId, col: gap.col, row: gap.row, ...size };
      const others = state.published.filter((p) => p.fixtureId === gap.fixtureId && p.id !== gap.id);
      if (!checkSpot(faceOf(gap), others, spot).ok) return state;
      const swap = (p: Placement) => (p.id === gap.id ? { ...p, ...spot, productId: product.id, adjusted: true } : p);
      const draft = state.drafts[gap.fixtureId];
      return { ...state, published: state.published.map(swap), drafts: draft ? { ...state.drafts, [gap.fixtureId]: draft.map(swap) } : state.drafts };
    }
  }
}
