import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/admins/actions", () => ({ addAdminAction: vi.fn(), removeAdminAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({ toast: vi.fn() }));

import type { AdminRow } from "@/lib/admin/admins";

import { AdminList } from "./admin-list";

const at = new Date("2026-11-20T10:00:00Z");
const admin = (userId: string, name: string): AdminRow => ({ userId, name, email: `${name.toLowerCase()}@example.com`, addedByName: "Liminal Bloom script", createdAt: at });

describe("AdminList", () => {
  it("lists each admin with their email and who added them, marks the one looking, and offers Remove on each", () => {
    render(<AdminList admins={[admin("u1", "Ada"), admin("u2", "Bo")]} currentUserId="u1" />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Ada");
    expect(rows[0]).toHaveTextContent("You");
    expect(rows[0]).toHaveTextContent("ada@example.com");
    expect(rows[0]).toHaveTextContent("Added by Liminal Bloom script");
    expect(rows[1]).not.toHaveTextContent("You");
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("offers no Remove when there is only one admin (the last stays)", () => {
    render(<AdminList admins={[admin("u1", "Ada")]} currentUserId="u1" />);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });
});
