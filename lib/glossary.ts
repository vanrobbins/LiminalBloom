// The app's words, explained (Week 6.5 spec §5.3): the text behind every ⓘ
// "What's this?" popover. At most two short sentences each, in plain words.

export const GLOSSARY = {
  space: { term: "Space on the fixture", text: "How wide a product is and how many rows it takes, hung or folded. The category sets it; a product changes it only when it differs." },
  sizeRange: { term: "Size range", text: "The sizes a product comes in, like XS–XL. A product uses its category's range unless it has its own." },
  presentation: { term: "Hung or folded", text: "Hung product hangs side by side on a rail. Folded product sits in stacks on a shelf or table." },
  pieces: { term: "Piece count", text: "How many of this product go in the spot: hangers side by side, or pieces in a stack." },
  face: { term: "Face", text: "One side of a fixture that holds product, such as the front of a wall bay or the top of a table." },
  planogram: { term: "Planogram", text: "The plan for what goes where on a fixture. The team works from the published version." },
  draft: { term: "Draft and published", text: "Changes are made in a draft first. Publishing makes the draft the version everyone sees." },
  dueDate: { term: "Due date", text: "When the team should have this planogram set up on the floor." },
  tableSet: { term: "Table set", text: "A table with lower tables against its sides. Planned together as one display." },
  frameRack: { term: "Frame rack", text: "A frame with one hanging rail. It holds hung product only." },
  run: { term: "Run", text: "Frame racks joined end to end, in a line, an L, a U or a square. A run is planned as one display." },
  rail: { term: "Rail", text: "The bar product hangs from. A frame rack has one." },
  zone: { term: "Zone", text: "An area of the store, such as the fitting rooms or the stockroom. Fixtures inside it belong to it." },
  status: { term: "Status", text: "In stock, sold out or on sale. Anyone can change it, and everyone sees it at once." },
  notPlaced: { term: "Not placed", text: "Products with no spot on the floor or in the stockroom yet." },
  swatch: { term: "Swatch and texture", text: "The color and pattern a product is drawn in when it has no photo. Without a swatch, its color word picks the color." },
  storeTime: { term: "Store time", text: "The time zone the store runs on. Dates like a planogram's due date follow it, wherever you are." },
} as const satisfies Record<string, { term: string; text: string }>;

export type Term = keyof typeof GLOSSARY;
