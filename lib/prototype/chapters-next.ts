// Chapters for the work being built now
// (specs written 11-02; the palette and roles/dashboards specs are still to write).

import type { Chapter } from "./types";

export const CHAPTERS_NEXT: Chapter[] = [
  {
    id: "space-and-drawings",
    status: "next",
    title: "Space on the fixture, sizes and drawings",
    lede: "How much room a product takes, said in plain words with a drawing, and asked only when the product differs from its category.",
    screen: "space",
    points: [
      {
        title: "Plain words",
        text: "“Hung: 1½ ft wide, 2 rows high. Folded: 1 ft by 1 ft.” The old word, “footprint”, is retired from the screens.",
      },
      {
        title: "A live drawing",
        text: "The space drawn on the half-foot grid, updating as the numbers change.",
      },
      {
        title: "Inherited from the category",
        text: "“Uses the Knit tops category's” until you choose “Different for this product”. Most products never need to.",
      },
      {
        title: "Size range chips",
        text: "XS–XL, S–XXL, 0–14, 24–34, One size. The category sets a default; a product can set its own.",
      },
      {
        title: "Swatch and texture",
        text: "Pick a colour on a wheel and one of six textures (rib, denim, cable knit and so on). The product's drawing is tinted to match.",
      },
    ],
    why: [
      "The product page and everything about size were too convoluted. The fix is one model used twice: the category sets space and size range, the product inherits them live, and a product only asks when it's different. A category change then reaches every product that hasn't opted out.",
      "Stack limits are dropped. Nobody set them, and the number on the fixture is better judged by the person folding.",
      "Products without a photo are drawn as they really sit: laid flat on cards, hung or folded on planogram tiles. Folded has two drawings, from above on a table top and from the front on a shelf, because that's how you see them. Twelve garment shapes cover the catalog.",
      "Every drawing gets a thin ink outline, and its details (collar, placket, pockets) are the fill darkened. That keeps any swatch, even one close to the page colour, visible in both light and dark mode with one rule.",
    ],
    underTheHood: [
      "Migration 0012: drops the stack limit, adds a default size range to categories, makes the product's size range nullable (empty = inherit), and adds swatch and texture columns.",
      "A real uploaded photo still wins on tiles; the drawing is the fallback. The demo seed stops uploading SVG pictures and stores swatch and texture instead, so there is one drawing path.",
      "Branches: `feature/products-merge`, `feature/space-sizes`, `feature/drawings`, `feature/tooltips`.",
    ],
  },
  {
    id: "frame-racks",
    status: "next",
    title: "Frame racks and runs",
    lede: "A new fixture: a frame with one hanging rail. Stores join several end to end into a straight line, an L, a U or a closed square, and plan the run as one display.",
    screen: "frame-run",
    points: [
      {
        title: "A frame rack on the map",
        text: "Drawn as a thin rectangle with a rail and end posts. Default 4 ft by 2 ft; only its width resizes.",
      },
      {
        title: "Linked into a run",
        text: "Up to six racks. The run moves and rotates as one; corners and “closed” are read from where the racks sit, never stored separately.",
      },
      {
        title: "One rail, one plan",
        text: "The planogram shows the whole run as one long rail, so a colour story can flow from rack to rack.",
      },
      {
        title: "Hung only",
        text: "Moving a folded product onto a frame rack switches it to hung, says so (“Switched to hung · Undo”), and is refused if it won't fit.",
      },
    ],
    why: [
      "Stores use frame racks next to ordinary racks, often several in a row against a column or wall. Planning each rack alone breaks up what shoppers see as one display.",
      "Runs reuse the table-set approach: one combined grid on screen, but each rack's placements are stored on that rack. Nothing spans two racks, so Search can still say exactly which rack a product hangs on: “Back wall, middle frame · Rail · 2–3½ ft from left”.",
      "There's one rail, so nothing hangs above anything else; only a product's hung width counts.",
    ],
    underTheHood: [
      "Migration 0013: a `frame_runs` table, and `run_id` plus `run_index` (0–5, the chain order) on each fixture. The first rack in the run holds the run's planogram.",
      "Linking is refused when two or more of the racks already have planograms, so no one's work is silently thrown away.",
      "The server re-checks “hung only” on every save and publish, not just in the browser.",
    ],
  },
  {
    id: "palette-and-tooltips",
    status: "next",
    title: "Command palette and tooltips",
    lede: "Jump anywhere from the keyboard, and get an explanation of any term without leaving the screen.",
    screen: "palette",
    points: [
      {
        title: "Ctrl K or ⌘ K",
        text: "Opens the palette on desktop; a Search button in the sidebar does the same for mouse and touch.",
      },
      {
        title: "Grouped results",
        text: "Products, planograms and zones in one list. Enter opens the highlighted one.",
      },
      {
        title: "Name tooltips",
        text: "Every icon-only button names itself on hover and on keyboard focus.",
      },
      {
        title: "“What's this?”",
        text: "An ⓘ beside app terms (frame rack, run, rail, space on the fixture) opens a short explanation. It opens on tap, so it works on a phone.",
      },
    ],
    why: [
      "The desktop sidebar had a search box that only jumped to the Search page. With Products merged, the palette replaces it and reaches more than products, as the original proposal promised (§3.12).",
      "Help sits next to every term that needs it. Hover-only help doesn't exist on a phone, which is where most people use the app, so terms get a tap-to-open popover and hover tooltips are kept for naming buttons.",
      "Tooltips go in as one sweep across every screen, rather than branch by branch, so no screen is left behind.",
    ],
    underTheHood: [
      "Tooltip and Popover come from Radix, which is already installed and styled through `components/ui/`.",
      "All explanation text lives in one glossary file, so a term is explained the same way everywhere.",
      "The palette's own spec is still to be written; the proposal lists `cmdk` for it, which needs approval before it's added.",
    ],
  },
  {
    id: "home",
    status: "next",
    title: "Roles and Home",
    lede: "Four roles, each opening to a Home screen built around its day. A VM Lead sees what's due and what's stuck; a Sales Associate sees search first.",
    screen: "home",
    live: { start: { name: "home" } },
    points: [
      {
        title: "Who and where",
        text: "Your name, your role in this store and the store's own date. A person can hold two roles, such as Sales Associate and VM Worker.",
      },
      {
        title: "Due soon",
        text: "Planograms due to be set on the floor, read in the store's time zone so nothing turns overdue a day early.",
      },
      {
        title: "Drafts in progress",
        text: "Work started but not published, with who touched it last.",
      },
      {
        title: "Sold out, still on display",
        text: "Products marked sold out that still hold space on a published planogram. Once Quick Adjust ships, each one starts one.",
      },
      {
        title: "Home tab",
        text: "Takes the slot Search left. Products, Layout, Planograms and Account follow.",
      },
    ],
    why: [
      "Home is a dashboard. A dashboard is only useful if it knows who is looking, so the four roles are built first, for real, and Home is built on them. No placeholder roles and no empty cards.",
      "Home uses only data that already exists. Cards for tasks, the review queue, shifts and My Day are added as those features ship.",
      "Store rename (Admins only) and the session changes ship here too, because both need the role check.",
    ],
    flow: {
      title: "What each role opens to",
      steps: [
        "Admin: due dates and overdue work",
        "VM Lead: drafts, the review queue, coverage for due dates",
        "VM Worker: today's VM work and drafts awaiting review",
        "Sales Associate: product search first, then My Day",
      ],
    },
    underTheHood: [
      "Better Auth's own roles (owner, admin, member) only govern administering a store and are never read as Admin or VM Lead. App roles live in their own tables.",
      "Permissions are checked on the server on every request, read fresh from the database, so a change takes effect on the person's next action.",
      "Changing your password signs out your other sessions.",
    ],
  },
];
