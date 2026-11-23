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
  run: { term: "Run", text: "Frame racks or wall bays joined end to end: in a line, an L, a U or a square; racks may also stand back to back, and bays may curve. A run is planned as one display." },
  rail: { term: "Rail", text: "The bar product hangs from. A frame rack has one." },
  zone: { term: "Zone", text: "An area of the store, such as the fitting rooms or the stockroom. Fixtures inside it belong to it." },
  status: { term: "Status", text: "In stock, sold out or on sale. Anyone can change it, and everyone sees it at once." },
  notPlaced: { term: "Not placed", text: "Products with no spot on the floor or in the stockroom yet." },
  swatch: { term: "Swatch and texture", text: "The color and pattern a product is drawn in when it has no photo. Without a swatch, its color word picks the color." },
  storeTime: { term: "Store time", text: "The time zone the store runs on. Dates like a planogram's due date follow it, wherever you are." },
  role: { term: "Role", text: "What a person can do in this store. Roles are ranked, and you can manage only people ranked below you." },
  invitation: { term: "Invitation link", text: "Whoever opens it signs in with the invited email and joins in that role. It works for 48 hours; send it yourself, because the app doesn't email it yet." },
  rank: { term: "Rank", text: "A role's place in the store's order, highest first. A role can manage only the people and roles ranked below it." },
  storeManager: { term: "Store Manager", text: "The top role in a store. It always keeps the permissions to manage people, roles and store settings, and a store always has at least one." },
  quickAdjust: { term: "Quick Adjust", text: "A temporary change on top of the published planogram, for when a product sells out. It stays until it is reverted or the next version is published." },
  permission: { term: "Permission", text: "Something a role lets people do, like publishing planograms. A change reaches everyone with that role on their next tap." },
  passkey: { term: "Passkey", text: "A key on your phone or computer, unlocked with your fingerprint, face or PIN. It signs you in without a password and counts as your second step." },
  twoStep: { term: "Two-step sign-in", text: "After your password, sign-in asks for a code from an authenticator app on your phone. Backup codes work once each if you lose the phone." },
} as const satisfies Record<string, { term: string; text: string }>;

export type Term = keyof typeof GLOSSARY;
