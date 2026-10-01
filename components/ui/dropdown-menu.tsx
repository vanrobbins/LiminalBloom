// A menu that drops down from a button: the store and account menus on tablet
// and desktop (phones use a bottom sheet instead, §5.2). Radix brings the
// keyboard handling -- arrows, typeahead, Escape, focus back to the button --
// and the ARIA roles; this file only styles it.
//
// Several small exports in one file, unlike the rest of components/ui: they
// are the parts of one menu and are never used apart.

"use client";

import { Check } from "lucide-react";
import { DropdownMenu as Menu } from "radix-ui";

const ITEM =
  "flex min-h-11 w-full cursor-default select-none items-center gap-3 rounded px-3 text-left text-sm text-ink outline-none data-[disabled]:opacity-60 data-[highlighted]:bg-line-subtle";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuRadioGroup = Menu.RadioGroup;

export function DropdownMenuContent({
  children,
  side = "bottom",
  align = "start",
}: {
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  return (
    <Menu.Portal>
      {/* It floats, so it gets a shadow (§5.5). Never wider than the screen. */}
      <Menu.Content
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={8}
        className="z-50 flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-64 max-w-[calc(100vw-16px)] flex-col overflow-y-auto rounded-lg border border-line bg-raised p-1 shadow-lg"
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export function DropdownMenuItem({
  className = "",
  ...props
}: React.ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={`${ITEM} ${className}`.trim()} {...props} />;
}

export function DropdownMenuRadioItem({
  className = "",
  children,
  ...props
}: React.ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem
      className={`${ITEM} wrap-anywhere data-[state=checked]:bg-brand data-[state=checked]:data-[highlighted]:bg-brand data-[state=checked]:font-medium data-[state=checked]:text-on-brand ${className}`.trim()}
      {...props}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <Menu.ItemIndicator>
        <Check aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      </Menu.ItemIndicator>
    </Menu.RadioItem>
  );
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return <Menu.Label className="px-3 py-2 text-sm text-ink-muted">{children}</Menu.Label>;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="my-1 h-px shrink-0 bg-line-subtle" />;
}
