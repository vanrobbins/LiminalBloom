// The pages and actions the palette offers, by what the viewer's role allows (spec §3.3).
// A feature adds its line here, as it does in nav-items.ts. Hiding is a courtesy: every
// target page or action still checks its own switch on the server.

import {
  Building2,
  CirclePlus,
  MapPinOff,
  LifeBuoy,
  Moon,
  PackageX,
  Pencil,
  ShieldCheck,
  Sun,
  Tags,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { NAV_ITEMS } from "@/components/shell/nav-items";
import { can, type Holder } from "@/lib/access/can";
import type { Switch } from "@/lib/access/switches";
import type { GroupableStore } from "@/lib/store-groups";
import type { Theme } from "@/lib/theme";

import { storeSwitchCommands } from "./store-commands";
import type {
  PaletteIndex,
  PaletteItem,
  PaletteProducts,
  Target,
} from "./types";

type Command = Extract<PaletteItem, { kind: "page" | "action" }>;

const NAV_KEYWORDS: Record<string, string> = {
  "/store": "people team staff employees invite settings",
  "/layout": "map floor",
};

export function commandsFor(
  holder: Holder,
  stores: readonly GroupableStore[],
  activeStoreId: string,
  theme: Theme,
  isPlatformAdmin = false,
  hasCompany = false,
): PaletteItem[] {
  const out: Command[] = [];
  const add = (
    kind: Command["kind"],
    id: string,
    label: string,
    icon: LucideIcon,
    target: Target,
    keywords = "",
    needs: Switch | null = null,
  ) => {
    if (needs === null || can(holder, needs))
      out.push({ kind, id: `${kind}:${id}`, label, keywords, icon, target });
  };
  const page = (href: string, label: string, icon: LucideIcon, keywords = "") =>
    add("page", href, label, icon, { href }, keywords, "view");
  const action = (
    href: string,
    label: string,
    icon: LucideIcon,
    keywords: string,
    needs: Switch | null,
  ) => add("action", href, label, icon, { href }, keywords, needs);

  for (const n of NAV_ITEMS)
    page(n.href, n.label, n.icon, NAV_KEYWORDS[n.href]);
  page("/account", "Account", User, "password profile sign in");
  page(
    "/account#two-factor",
    "Two-step sign-in",
    ShieldCheck,
    "two-factor 2fa authenticator backup codes passkey security",
  );
  page("/help", "Help", LifeBuoy, "ask liminal bloom support contact reply");
  if (hasCompany)
    add(
      "page",
      "/company",
      "Company",
      Building2,
      { href: "/company" },
      "regions stores region company people",
    );
  if (isPlatformAdmin)
    add(
      "page",
      "/admin",
      "Liminal Bloom admin",
      ShieldCheck,
      { href: "/admin" },
      "platform admin help queue stores people",
    );
  page(
    "/products?place=unplaced",
    "Products not placed",
    MapPinOff,
    "unplaced missing",
  );
  page(
    "/products?status=sold_out",
    "Sold out products",
    PackageX,
    "out of stock",
  );

  action(
    "/products/new",
    "Add product",
    CirclePlus,
    "new create",
    "products.edit",
  );
  action(
    "/products/categories",
    "Categories",
    Tags,
    "sizes space",
    "products.edit",
  );
  action(
    "/layout/edit",
    "Edit the store map",
    Pencil,
    "layout draw fixtures",
    "layout.edit",
  );
  action(
    "/store/roles",
    "Roles and permissions",
    ShieldCheck,
    "switches access",
    "roles.manage",
  );
  const toDark = theme === "light";
  add(
    "action",
    "theme",
    toDark ? "Switch to dark theme" : "Switch to light theme",
    toDark ? Moon : Sun,
    { theme: true },
    "mode appearance",
  );
  out.push(...storeSwitchCommands(stores, activeStoreId));
  action("/create-store", "Create a store", CirclePlus, "new store", null);
  return out;
}

/**
 * Quick Adjust <fixture> and Adjust <product> (0.7.0.9, DECISIONS 11-17 Q7; this extends spec §3.3 on purpose). They
 * come from what the palette has loaded, so they are a separate list the groups add only while something is typed. A
 * planogram needs a published version to have an adjust page; a product needs the server to have named its fixture,
 * which it does only for planograms.draft. The ids start "action:adjust:" so Recent never keeps them.
 */
export function adjustCommands(
  holder: Holder,
  index: PaletteIndex | null,
  products: PaletteProducts | null,
): PaletteItem[] {
  if (!can(holder, "planograms.draft")) return [];
  const command = (
    id: string,
    label: string,
    keywords: string,
    href: string,
  ): PaletteItem => ({
    kind: "action",
    id: `action:adjust:${id}`,
    label,
    keywords,
    icon: Zap,
    target: { href },
  });
  return [
    ...(index?.planograms ?? [])
      .filter((p) => p.published)
      .map((p) =>
        command(
          `planogram:${p.fixtureId}`,
          `Quick Adjust ${p.name}`,
          `${p.typeHint ?? ""} ${p.zoneName} sold out`,
          `/planograms/${p.fixtureId}/adjust`,
        ),
      ),
    ...(products?.products ?? []).flatMap((p) =>
      p.adjustFixtureId
        ? [
            command(
              `product:${p.id}`,
              `Adjust ${p.name}`,
              `${p.styleNumber} quick`,
              `/planograms/${p.adjustFixtureId}/adjust?product=${p.id}`,
            ),
          ]
        : [],
    ),
  ];
}
