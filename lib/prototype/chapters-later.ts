// Chapters for Weeks 7–12 (planned, not built) and the closing architecture chapter.

import type { Chapter } from "./types";

export const CHAPTERS_LATER: Chapter[] = [
  {
    id: "quick-adjust",
    week: "Week 7 · milestone",
    status: "planned",
    title: "Quick Adjust: the core loop",
    lede: "A product sells out. The app lists every display it leaves a gap in, suggests what fits, and lets the team fix it from a phone in under two minutes.",
    screen: "quick-adjust",
    points: [
      {
        title: "What it affects",
        text: "Marking the Straight jean sold out lists every published display it sits on, with the space it leaves.",
      },
      {
        title: "Before and after",
        text: "The adjusted display next to the original: stacked on a phone, side by side on larger screens.",
      },
      {
        title: "Suggestions that fit",
        text: "In-stock products from the same category and colour family that fit the open space. No AI needed.",
      },
      {
        title: "Submit or publish",
        text: "A VM Worker submits the adjustment for review; a VM Lead publishes it, and Search shows the new spot at once.",
      },
    ],
    why: [
      "This is the feature the project exists for. Week 7's milestone is a live demo of the loop on a phone: sold out, to a published adjustment, everyone sees it.",
      "An adjustment is a layer on top of the monthly planogram, not a replacement. When next month's planogram is published, adjustments are cleared or reviewed, so temporary fixes never quietly become the plan.",
      "Week 7 also enforces the four roles on every feature: Sales Associates can mark status but not move products, VM Workers draft, VM Leads publish. The rules are checked by the server, not only hidden on screen.",
    ],
    flow: {
      title: "After a sellout",
      steps: [
        "Associate marks the Straight jean sold out",
        "The app lists every affected display",
        "VM Worker picks a replacement that fits",
        "Submits it for review",
        "VM Lead compares and publishes",
      ],
    },
    underTheHood: [
      "A new `adjustments` table with draft, in review and published states, linked to the planogram version it adjusts.",
      "Open-space matching uses the grid that's already stored: the half-foot cells a placement covers tell exactly what a replacement must fit into.",
      "Measured in Week 10: a sold-out product becomes a published adjustment in under 2 minutes.",
    ],
  },
  {
    id: "week-8",
    week: "Week 8",
    status: "planned",
    title: "Review, sharing, price and bigger screens",
    lede: "The handoff between the people who draft and the people who publish, plus the extras that make the builder comfortable on a tablet or desk.",
    screen: "review",
    points: [
      {
        title: "Review queue",
        text: "Drafts and adjustments waiting for a VM Lead, oldest first, each naming who sent it.",
      },
      {
        title: "Approve or ask for changes",
        text: "Approving publishes. Asking for changes sends it back with a note.",
      },
      {
        title: "Print and share",
        text: "A print-friendly view and a read-only link for the floor, for anyone without the app open.",
      },
      {
        title: "Price on the display",
        text: "Each display shows its average price two ways: each product once, and weighted by how much space it takes.",
      },
    ],
    why: [
      "VM Workers set most displays, but VM Leads are accountable for them. The review queue lets the people on the floor do the work and the lead check it, without a lead standing over every table.",
      "The builder grows on bigger screens: library and properties panels beside the grid, keyboard shortcuts, right-click menus, and resizing folded stacks by their corner. The phone stays the first and complete version.",
      "Price comes after the demo because nothing in the core loop needs it. Two averages, because a plain average is easy to explain, and a space-weighted one matches what a shopper actually sees.",
    ],
    underTheHood: [
      "Migration 0014: an optional price in whole cents, so sums never drift.",
      "Invitations by email (Resend), with invite tokens encrypted by the store's key; email verification switches on at the same time.",
      "Key rotation: an Admin can replace the store's key; the server re-encrypts the store's secrets and retires the old key.",
    ],
  },
  {
    id: "week-9",
    week: "Week 9",
    status: "planned",
    title: "Tasks, the VM schedule and My Day",
    lede: "Display work, assigned to the people scheduled to do it. Each person gets their day in time order, with every task's location attached.",
    screen: "my-day",
    points: [
      {
        title: "Now",
        text: "The block you're in is marked, with its tasks open underneath.",
      },
      {
        title: "Tasks with locations",
        text: "Check them off where they happen. Finishing a planogram's task marks the display as set on the floor.",
      },
      {
        title: "Working with",
        text: "Who else is on the block, such as a two-person denim refold.",
      },
      {
        title: "Not yet scheduled",
        text: "Assigned tasks without VM time yet, so nothing falls through.",
      },
    ],
    why: [
      "The third problem from the proposal: VM Leads assign display work without knowing who has VM time to do it. The schedule fixes that by planning VM time only. It does not replace the store's main staff schedule.",
      "A VM Lead builds the schedule as a grid, people down the side and time across the top. A block can cover several people. Linking a planogram's task to a block assigns it to whoever is on it, and Home warns about any due date with no time scheduled to meet it.",
      "The Roles and Permissions panel also arrives: an Admin can rename roles (“Sales Associate” to “Educator”) and switch permissions on or off. The Admin role's own powers are locked, and every change is logged.",
    ],
    flow: {
      title: "Schedule VM time (VM Lead)",
      steps: [
        "Open Thursday in the team grid",
        "Drag a denim refold block across two people",
        "Link the planogram's task to it",
        "The coverage warning on Home clears",
      ],
    },
    underTheHood: [
      "Tables: `tasks`, `shifts`, `shift_tasks`, `roles`, `role_permissions`, `permission_changes`.",
      "Shifts are shown in the store's time zone (added in Week 6), with a zone label only when your device is somewhere else.",
      "The scheduler's spec (11-01) builds it as a shared package so a standalone personal-schedule app can use it too. That app is new scope and waits for the course outline to be updated.",
    ],
  },
  {
    id: "week-10",
    week: "Week 10",
    status: "planned",
    title: "Testing with a real store",
    lede: "Two team members from a real store run the everyday flows on their own phones, without help, while the clock runs.",
    screen: "checklist",
    points: [
      {
        title: "Find in under 10 seconds",
        text: "Any user finds a product's fixture and spot on a phone. Timed in the session.",
      },
      {
        title: "Sold out to published in under 2 minutes",
        text: "The Week 7 loop, timed with a real VM Lead.",
      },
      {
        title: "New product placed in under 2 minutes",
        text: "A new arrival with no place gets one and is published.",
      },
      {
        title: "Readable and reachable",
        text: "WCAG AA contrast in both themes, and every touch target at least 44 px.",
      },
    ],
    why: [
      "Every measure here was written into the proposal before any code, so the app is checked against what was promised, not against what got built.",
      "Device testing happens on a physical iPhone and tablet as well: a few things, like the safe area under the bottom tabs, only show up on real hardware.",
      "Whatever the session turns up gets fixed in the rest of the week.",
    ],
    underTheHood: [
      "Already automated: the builder refuses every overlap and off-edge placement (unit tests); key screens work at 375, 820 and 1280 px (Playwright); one store can't read or decrypt another's data (database tests, mutation-checked).",
      "An accessibility review against the same criteria runs before the session.",
    ],
  },
  {
    id: "finish",
    week: "Weeks 11–12",
    status: "planned",
    title: "AI Auto-Build, polish and the presentation",
    lede: "If time allows, a store connects its own AI provider and asks for a layout. Either way, the last weeks are polish, documentation and the final presentation.",
    screen: "ai-connection",
    points: [
      {
        title: "The store's own provider",
        text: "An Admin picks a provider and model and pastes the store's key. The app tests it before saving.",
      },
      {
        title: "Masked key",
        text: "After saving, only the last four characters are ever shown. Replace or remove it at any time.",
      },
      {
        title: "Usage",
        text: "Requests this week and this month, so the store can see its own cost.",
      },
      {
        title: "Until it's connected",
        text: "AI buttons stay disabled with a note pointing Admins here. Every other feature, Quick Adjust's suggestions included, works without AI.",
      },
    ],
    why: [
      "AI is a “Could” item: nice to have, cut first if time runs short. The app ships no shared AI account, so each store controls its provider, usage and bill.",
      "A VM Lead picks a fixture and products, adds guidance such as “colour block light to dark”, and the proposal appears on the builder grid to accept, edit or discard. Every AI result is checked for overlaps and fit before it's shown, exactly like a person's move.",
      "Week 6.5 pushed the schedule back by a week, so the finish runs through Week 12: polish, documentation and the presentation.",
    ],
    underTheHood: [
      "Tables: `ai_connections` (the key locked with the store's key, decrypted only on the server for one request) and `ai_build_requests` (a log of every request and result).",
      "Every AI response is validated with Zod before it touches the grid.",
    ],
  },
  {
    id: "under-the-hood",
    week: "Architecture",
    status: "about",
    title: "How a request travels",
    lede: "Every action takes the same path. Nothing reaches the database, files or an AI provider until the server has answered three questions.",
    screen: "request-path",
    points: [
      {
        title: "The device",
        text: "Phone, tablet or computer. It shows screens and sends requests. It stores no data and no keys.",
      },
      {
        title: "Who are you?",
        text: "A signed-in session, checked by Better Auth, and still a member of this store.",
      },
      {
        title: "Are you allowed?",
        text: "The role's permissions, read fresh from the database.",
      },
      {
        title: "Is it valid?",
        text: "Input parsed with Zod: forms, URLs and AI results alike.",
      },
      {
        title: "Where it goes",
        text: "Only now: the database under row-level security, private files, or the store's AI provider.",
      },
    ],
    why: [
      "Each store is treated as its own locked room. Every query is filtered to the session's store, and the database enforces the same rule a second time, so one forgotten filter can't leak another store's rows.",
      "Secrets use three layers of keys: a master key in the server's environment locks each store's key, and each store key locks that store's secrets. Reading one store's secrets needs both, and one store's key opens nothing anywhere else.",
      "Security code is mutation-tested: each safeguard was deliberately broken to prove a test fails without it.",
    ],
    underTheHood: [
      "Server actions and route handlers in Next.js 16; no API is reachable without the session check.",
      "Store data under row-level security today: the map, products, planograms and settings. `store_keys` follows when its hook is reworked.",
      "Production runs on its own Neon database branch; migrations reach production only by hand, after review.",
    ],
  },
];
