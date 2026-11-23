// The Quick Adjust lines sit under the status row (the version line), not above the screen (0.7.0.9 spec §4.4).

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PublishedVersion } from "@/lib/planograms/queries";
import type { PlanogramFace, PlanogramScope } from "@/lib/planograms/types";

vi.mock("@/app/(app)/planograms/actions", () => ({ pickerSearch: vi.fn(), beginDraftAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/store-map/use-media-query", () => ({ PHONE_QUERY: "", useMediaQuery: () => false }));

import { EVERYTHING } from "@/lib/access/test-guard";
import { PlanogramScreen } from "./planogram-screen";

const front: PlanogramFace = { faceId: "00000000-0000-4000-8000-000000000001", fixtureId: "r", fixtureName: "Rack 1", fixtureType: "rack", side: "front", setSide: null, label: "Front", columns: 8, rows: 6 };
const scope: PlanogramScope = { fixtureId: "r", fixtureName: "Rack 1", isSet: false, faces: [front] };
const latest: PublishedVersion = { number: 3, publishedAt: new Date("2026-10-08T12:00:00Z"), publishedByName: "Van", summary: null, placements: [] };

describe("PlanogramScreen afterStatus", () => {
  it("renders it right after the version line and before the grid", () => {
    render(<PlanogramScreen member={EVERYTHING} scope={scope} row={null} latest={latest} draft={null} viewing={null} looks={{}} highlightProductId={null} dueDate={null} today="2026-10-11" afterStatus={<p data-test-after>Quick Adjust · since Nov 17</p>} />);
    const version = document.querySelector("[data-version-line]") as HTMLElement;
    const after = screen.getByText(/Quick Adjust · since/);
    const grid = document.querySelector("[data-planogram-grid]") as HTMLElement;
    expect(version.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(after.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
