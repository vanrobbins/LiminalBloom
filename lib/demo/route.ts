// Where the demo app can be. Held in React state, never the URL.

export type Route =
  | { name: "home" }
  | { name: "products" }
  | { name: "layout"; fixtureId?: string }
  | { name: "planograms" }
  | { name: "planogram"; fixtureId: string; faceId?: string; selectId?: string }
  | { name: "quick-adjust"; placementId?: string }
  | { name: "account" };
