// Chapters for what is already on main and live at liminalbloom.vanar.me
// (Weeks 1–6), plus the opening chapter.

import type { Chapter } from "./types";

export const CHAPTERS_LIVE: Chapter[] = [
  {
    id: "welcome",
    week: "Overview",
    status: "about",
    title: "Keep the floor matching the plan",
    lede: "Liminal Bloom is a phone-first app for retail store teams. It answers two questions all day long: where does this product go, and how should the display look now that stock has changed?",
    screen: "core-loop",
    points: [
      {
        title: "Stock changes",
        text: "A product sells out, goes on sale, or arrives new with no place in this month's planogram. This happens every day; the plan only arrives once a month.",
      },
      {
        title: "The app flags the gaps",
        text: "Every display the product sits on is listed, with the space it leaves open, or the open space a new product would fit into.",
      },
      {
        title: "The team adjusts",
        text: "On a phone, on the floor. The app suggests products that fit the open space, and the person moves things on a drawn copy of the fixture before touching the real one.",
      },
      {
        title: "Everyone sees it",
        text: "Once published, the new location is what everyone gets when they search, whether they're on the floor or in the stockroom.",
      },
    ],
    why: [
      "Most stores get a new planogram (a drawing of where each product goes on a fixture) once a month. Between releases the product keeps changing and the plan doesn't. Each person improvises, the floor drifts, and the stockroom stops agreeing with the floor about where things live.",
      "The whole app is built around the loop on the right. Product search and Quick Adjust deliver it; the store map, planograms, roles and the scheduler exist to feed it. That is also the build order: the loop's pieces first (Weeks 1–7), team features next (Weeks 8–9), then testing with a real store and polish (Weeks 10–12).",
      "How to read this walkthrough: each chapter is one screen. The phone on the right is a drawing of that screen, not the working app. Numbered dots on it match the numbered points in the text; tap either one to link them. Each chapter's label says whether it's live today, being built now (Week 6.5), or planned for a later week. Screens are drawn as the app will look once Week 6.5 is done, so Home already sits in the tabs.",
      "Use the arrow keys, the Back and Next buttons, or the chapter list to move around. Each chapter has its own link, so you can send someone straight to one.",
    ],
    underTheHood: [
      "Next.js 16 (App Router, server actions) with React 19 and TypeScript, styled with Tailwind 4 using the app's own colour tokens in OKLCH, light and dark.",
      "PostgreSQL on Neon, through Drizzle ORM. Every schema change is a generated, committed migration; 0000–0011 exist today.",
      "Better Auth for accounts and sessions; Vercel for hosting and file storage (Blob).",
      "About 1,100 unit tests (Vitest) and about 350 browser tests (Playwright) at phone, tablet and desktop sizes, in both themes where colour matters.",
    ],
  },
  {
    id: "sign-in",
    week: "Weeks 1–2",
    status: "live",
    title: "Getting in, and choosing a store",
    lede: "One account, several stores. Signing in opens the store you used last, and a single tap switches to another.",
    screen: "sign-in",
    points: [
      {
        title: "Email and password",
        text: "Sign-up and sign-in stay on “Signing in…” until the next page has actually loaded, and an offline request says so instead of hanging.",
      },
      {
        title: "Keep me signed in",
        text: "Coming with roles in Week 6.5. Leave it off on a shared store tablet and the session ends when the browser closes.",
      },
      {
        title: "The current store",
        text: "Marked in gold, the colour reserved for the brand mark, the main action and the current selection. Gold is never a status.",
      },
      {
        title: "New store",
        text: "Anyone can create a store and becomes its owner. They pick the store's time zone as they create it, so due dates and “today” are the store's, not the server's.",
      },
    ],
    why: [
      "Store team members often work at more than one location, especially seasonal staff and VM specialists who cover a district. So a person belongs to stores rather than being a store, and each request works in exactly one of them.",
      "Which store a request works in is never taken from the browser. On every request the server re-checks that the person is still a member of the store their session points at. Someone removed from a store on Monday can't keep using it from a phone they signed in on last week.",
      "Email verification is switched off for now. Turning it on before an email service (Resend) is connected would lock everyone out; it is scheduled with invitations.",
    ],
    flow: {
      title: "First visit",
      steps: [
        "Create an account",
        "Name the store and pick its time zone",
        "Land on Products (Home, once the dashboards ship in Week 6.5)",
      ],
    },
    underTheHood: [
      "Better Auth: hashed passwords, HTTP-only session cookies. Stores are Better Auth organizations; `resolveActiveStore` re-checks membership on every request.",
      "Every store gets its own random 256-bit key when it is created. That key is stored only after being locked with a master key that lives in the server's environment, never in the database (envelope encryption, AES-256-GCM).",
      "Each encrypted value carries its store's id as extra authenticated data, so a value copied into another store refuses to decrypt instead of leaking. This rule is mutation-tested: remove it and a test fails.",
    ],
  },
  {
    id: "store-map",
    week: "Week 3",
    status: "live",
    title: "The store map",
    lede: "A to-scale drawing of the sales floor: the walls, the doors, the zones and every table, rack and wall bay. Everything else in the app points back to it.",
    screen: "store-map",
    points: [
      {
        title: "Zones",
        text: "Areas of the floor, such as Denim or Front tables, each drawn as a shape in its own muted colour. Text on every zone colour passes contrast checks in both themes.",
      },
      {
        title: "A table set",
        text: "An upper table with lower tables pushed against its sides. It's planned as one display but each table keeps its own grid.",
      },
      {
        title: "Entrance",
        text: "Doors sit on the outline's walls, so the map reads the way you walk in.",
      },
      {
        title: "Fixture panel",
        text: "Tap a fixture to see its published planogram without leaving the map.",
      },
    ],
    why: [
      "A location only helps if people recognise it. “Rack 2” means something when you can see Rack 2 is the one by the fitting rooms.",
      "Liminal Bloom's predecessor (Merch Mobile, a Flutter app) had a map that mixed up coordinate spaces, broke when things rotated, and had gestures that fought each other. This map was built with a guard for each of those bugs: one coordinate space (whole inches), one file that knows about rotation, and one gesture state machine where a press has exactly one outcome.",
      "Viewing the map lives inside the app; editing it opens full screen at /layout/edit, because drawing walls on a phone needs every pixel.",
    ],
    flow: {
      title: "Set up a store",
      steps: [
        "Draw the floor outline",
        "Place the entrance on a wall",
        "Draw zones",
        "Drop fixtures in at their real size",
        "Group tables into a set and choose each face's grid",
      ],
    },
    underTheHood: [
      "Tables: `store_layouts`, `entrances`, `zones`, `fixtures`, `fixture_faces`, `table_sets`. Every row carries `store_id` and a `version` number, so a save from a stale screen is refused instead of overwriting newer work.",
      "Row-level security in PostgreSQL is the second wall between stores: every map query runs through `withStore`, which sets the store for that transaction and switches to a role whose policies only see that store's rows. If the store isn't set, the policies see nothing.",
      "The editor's core (geometry, validation, snapping, undo) is plain TypeScript with no React, so it is tested directly, including property tests with fast-check.",
    ],
  },
  {
    id: "products",
    week: "Week 4 · merged in 6.5",
    status: "live",
    title: "Products: search and catalog in one place",
    lede: "One screen finds any product in seconds and manages the catalog. It is the first thing a Sales Associate needs, so it's where sign-in lands until Home ships.",
    screen: "products",
    points: [
      {
        title: "One search box",
        text: "Matches name, style number, category and colour as you type, and forgives typos: “hi rise pnt” finds the High-Rise Pant.",
      },
      {
        title: "Count and sort",
        text: "“30 of 47 products”, then Show more for the next 30. Sort by best match, name, recently updated or newest.",
      },
      {
        title: "Where it is, first",
        text: "Each card leads with the location in plain words. “Not placed” doubles as a to-do list when browsing.",
      },
      {
        title: "Status",
        text: "Always a word and an icon, never colour alone: In stock (sage), Sold out (brick), On sale (dusty blue).",
      },
      {
        title: "Add and manage",
        text: "On a phone, + adds a product and ⋯ opens Categories, both on the title row so nothing floats over the list. Larger screens show labelled buttons.",
      },
    ],
    why: [
      "Until Week 6.5 there were two screens, Products and Search, that both listed products. The instructor's feedback was that they overlapped and confused people, so they merge into one Products screen. The /search address keeps working and forwards to it.",
      "Cards lead with location because the question on the floor is almost always “where is it?”, not “what is it?”. The photo and name confirm you've found the right thing; the location is what you came for.",
      "Show more keeps the page light on store Wi-Fi. Refreshing goes back to the first 30, which is predictable and cheap.",
      "Status changes save immediately and offer Undo. If another device changed the same product a moment earlier, the change is refused and the card shows the current status rather than silently overwriting it.",
    ],
    underTheHood: [
      "Tables: `products`, `product_categories`, `product_footprints`, `product_locations`, `stockroom_bins`, all under row-level security.",
      "Typo-tolerant search uses PostgreSQL's `pg_trgm` (trigram similarity) on product names, combined with exact matches on style number.",
      "Photos are stored privately in Vercel Blob and served through /api/images, which checks the product belongs to your active store before sending a byte.",
      "A demo store (`npm run db:seed:demo`) holds 50 realistic products in 7 categories, placed on the map and in 12 stockroom bins.",
    ],
  },
  {
    id: "locator",
    week: "Weeks 4–6",
    status: "live",
    title: "Find a product: the location sheet",
    lede: "Tap a product and a sheet slides up with everything needed to walk to it: where on the map, where on the fixture, and how it should be presented.",
    screen: "locator",
    points: [
      {
        title: "Status control",
        text: "Change it right here. It saves at once, with Undo in the toast.",
      },
      {
        title: "Mini map",
        text: "The store map with the fixture highlighted, so you know which way to walk.",
      },
      {
        title: "In words and feet",
        text: "“Rack 2 · Top rail · 2–3½ ft from left”. People on the floor measure with their hands and eyes, not with grid codes.",
      },
      {
        title: "The fixture's face",
        text: "A drawing of that side of the fixture with the product's space outlined in gold.",
      },
      {
        title: "Open planogram",
        text: "Jumps to the full planogram, opened on the face the product sits on.",
      },
    ],
    why: [
      "The success measure is that anyone finds a product's spot on a phone in under 10 seconds. Everything on the sheet serves that, in the order you need it: is it in stock, which fixture, which part of the fixture.",
      "Early versions named spots with grid codes like “A4”. In Week 6 they became words and feet, because that's how people describe a spot out loud. Lower tables are read the way you see them standing at the outer edge, so left and right never flip on you.",
      "On a phone the sheet slides up from the bottom; on tablet and desktop the same content sits in a side panel next to the results.",
    ],
    flow: {
      title: "Find a product (any role)",
      steps: [
        "Type “high-rise pant”",
        "Filter by colour",
        "Read “Wall bay 3 · Middle shelf · 2–3 ft from left · Folded · In stock”",
        "Open the planogram with its space highlighted",
      ],
    },
    underTheHood: [
      "Locations come from `product_locations`, which only publishing a planogram writes. Search never guesses from a draft.",
      "`location-words.ts` turns stored grid spans into words and feet, mirroring cells for lower tables on the back or right of a set.",
    ],
  },
  {
    id: "planograms",
    week: "Weeks 5–6",
    status: "live",
    title: "Planograms and the builder",
    lede: "Every fixture has one planogram: a grid drawn to the half foot, where each product takes up real space. Lay it out on a phone, then publish it to the team.",
    screen: "planogram",
    points: [
      {
        title: "Faces",
        text: "A rack has a front and a back; a table has a top. Swipe or tap to switch. A table set shows all its tables as one combined grid.",
      },
      {
        title: "The half-foot grid",
        text: "Columns are half a foot wide, so what you see on the screen is what fits on the fixture. Products snap into place instead of needing pixel-perfect dragging.",
      },
      {
        title: "Selected product",
        text: "Tap to select, then drag to move or pull an edge to resize. While moving, open space highlights; if something is in the way, the app names it: “Blocked by Crew sock”.",
      },
      {
        title: "Undo",
        text: "Every change can be undone from the toast, or with Ctrl+Z and Ctrl+Shift+Z on a keyboard.",
      },
      {
        title: "Draft, then publish",
        text: "Changes collect in a draft. Publishing makes them the version everyone sees, with a due date for setting it on the floor.",
      },
    ],
    why: [
      "The grid works like inventory in a video game: every item takes a fixed shape, nothing can overlap, and empty space is visible at a glance. That makes planograms consistent between people, easy to check, and workable on a phone, since a tap always lands on a defined spot.",
      "Drafts are separate from what's published, so a VM Lead can rework a display through the day without the floor seeing half-finished changes. Two devices can edit the same draft; each save returns the whole draft so both stay in step.",
      "Every publish keeps a frozen copy, so the history page can show any earlier version and restore it as a new draft. Nothing published is ever overwritten.",
    ],
    flow: {
      title: "Build and publish (VM Lead)",
      steps: [
        "Open the fixture's planogram",
        "Add products; each lands in the first open space that fits",
        "Drag and resize; overlaps are refused with a reason",
        "Set a due date",
        "Publish a new version",
      ],
    },
    underTheHood: [
      "Tables: `planograms` (one per fixture), `planogram_placements` (the draft) and `planogram_versions` (insert-only, each a JSONB snapshot).",
      "Publishing rewrites that fixture's `product_locations` in one guarded database batch, so Search changes the moment a planogram is published, never halfway.",
      "The builder's gestures (drag, resize, keys, undo, matching, placing) are pure functions in `lib/planograms/builder/`; the browser tests use real touch events to tell a drag from a swipe.",
    ],
  },
];
