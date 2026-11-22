// The pages and actions the palette offers, by what the viewer's role allows (spec §3.3).
// A feature adds its line here, as it does in nav-items.ts. Hiding is a courtesy: every
// target page or action still checks its own switch on the server.

import { CirclePlus, MapPinOff, Moon, PackageX, Pencil, ShieldCheck, Store, Sun, Tags, User, type LucideIcon } from "lucide-react";

import { NAV_ITEMS } from "@/components/shell/nav-items";
import { can, type Holder } from "@/lib/access/can";
import type { Switch } from "@/lib/access/switches";
import type { Theme } from "@/lib/theme";

import type { PaletteItem, Target } from "./types";

type Command = Extract<PaletteItem, { kind: "page" | "action" }>;
type StoreRef = { id: string; name: string };

const NAV_KEYWORDS: Record<string, string> = { "/store": "people team staff employees invite settings", "/layout": "map floor" };

export function commandsFor(holder: Holder, stores: readonly StoreRef[], activeStoreId: string, theme: Theme): PaletteItem[] {
  const out: Command[] = [];
  const add = (kind: Command["kind"], id: string, label: string, icon: LucideIcon, target: Target, keywords = "", needs: Switch | null = null) => {
    if (needs === null || can(holder, needs)) out.push({ kind, id: `${kind}:${id}`, label, keywords, icon, target });
  };
  const page = (href: string, label: string, icon: LucideIcon, keywords = "") => add("page", href, label, icon, { href }, keywords, "view");
  const action = (href: string, label: string, icon: LucideIcon, keywords: string, needs: Switch | null) =>
    add("action", href, label, icon, { href }, keywords, needs);

  for (const n of NAV_ITEMS) page(n.href, n.label, n.icon, NAV_KEYWORDS[n.href]);
  page("/account", "Account", User, "password profile sign in");
  page("/products?place=unplaced", "Products not placed", MapPinOff, "unplaced missing");
  page("/products?status=sold_out", "Sold out products", PackageX, "out of stock");

  action("/products/new", "Add product", CirclePlus, "new create", "products.edit");
  action("/products/categories", "Categories", Tags, "sizes space", "products.edit");
  action("/layout/edit", "Edit the store map", Pencil, "layout draw fixtures", "layout.edit");
  action("/store/roles", "Roles and permissions", ShieldCheck, "switches access", "roles.manage");
  const toDark = theme === "light";
  add("action", "theme", toDark ? "Switch to dark theme" : "Switch to light theme", toDark ? Moon : Sun, { theme: true }, "mode appearance");
  for (const s of stores.filter((s) => s.id !== activeStoreId)) add("action", `store:${s.id}`, `Switch to ${s.name}`, Store, { storeId: s.id }, "store");
  action("/create-store", "Create a store", CirclePlus, "new store", null);
  return out;
}
