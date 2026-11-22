// The adjust page's guard and reads (0.7.0.9 spec §3, §4.2): it needs planograms.draft (a viewer without it never gets as
// far as a read), is a 404 with nothing published, and hands ?product= to the screen only when it is an id.

import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const FIXTURE = randomUUID();
const PRODUCT = randomUUID();
const mocks = vi.hoisted(() => ({
  requireSwitch: vi.fn(),
  loadPlanogram: vi.fn(),
  screen: vi.fn(() => null),
}));
vi.mock("@/lib/current-member", () => ({ requireSwitch: mocks.requireSwitch }));
vi.mock("@/lib/layout/load", () => ({ loadLayout: async () => ({ fixtures: [] }) }));
vi.mock("@/lib/planograms/faces", () => ({
  planogramOwner: () => ({ id: FIXTURE }),
  planogramScope: () => ({ fixtureId: FIXTURE, fixtureName: "Wall bay 3", isSet: false, faces: [{ faceId: "f" }] }),
}));
vi.mock("@/lib/planograms/queries", () => ({ loadPlanogram: mocks.loadPlanogram }));
vi.mock("@/lib/planograms/product-looks", () => ({ productLooks: async () => ({}) }));
vi.mock("@/components/quick-adjust/quick-adjust-screen", () => ({ QuickAdjustScreen: mocks.screen }));
vi.mock("@/components/shell/page-header", () => ({ PageHeader: () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

import AdjustPage from "./page";

const member = { activeStoreId: "store", switches: ["view", "planograms.draft"] };
const published = { number: 3, placements: [] };
const state = (over: object = {}) => ({ row: { id: "p", publishedVersion: 3 }, latest: published, draft: null, adjustments: { draft: null, published: null }, ...over });
const render = (params: { fixtureId: string }, query: Record<string, string> = {}) => AdjustPage({ params: Promise.resolve(params), searchParams: Promise.resolve(query) });
const propsOfScreen = (element: unknown) => ((element as { props: { children: { props: Record<string, unknown> }[] } }).props.children[1] as { props: Record<string, unknown> }).props;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSwitch.mockResolvedValue(member);
  mocks.loadPlanogram.mockResolvedValue(state());
});

describe("AdjustPage", () => {
  it("requires planograms.draft before reading anything", async () => {
    mocks.requireSwitch.mockRejectedValue(new Error("REDIRECT /no-access"));
    await expect(render({ fixtureId: FIXTURE })).rejects.toThrow("/no-access");
    expect(mocks.requireSwitch).toHaveBeenCalledWith("planograms.draft");
    expect(mocks.loadPlanogram).not.toHaveBeenCalled();
  });

  it("is a 404 for something that isn't an id", async () => {
    await expect(render({ fixtureId: "nope" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a 404 with no published version: nothing to adjust", async () => {
    mocks.loadPlanogram.mockResolvedValue(state({ row: { id: "p", publishedVersion: null }, latest: null }));
    await expect(render({ fixtureId: FIXTURE })).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.loadPlanogram.mockResolvedValue(state({ row: null, latest: null }));
    await expect(render({ fixtureId: FIXTURE })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("reads the planogram with its adjustments and gives the screen the version, both adjustments and the member", async () => {
    const element = await render({ fixtureId: FIXTURE });
    expect(mocks.loadPlanogram).toHaveBeenCalledWith("store", FIXTURE, true);
    expect(propsOfScreen(element)).toMatchObject({ version: published, draft: null, published: null, member, productId: null });
  });

  it("passes ?product= on when it is an id, and drops it when it is not", async () => {
    expect(propsOfScreen(await render({ fixtureId: FIXTURE }, { product: PRODUCT }))).toMatchObject({ productId: PRODUCT });
    expect(propsOfScreen(await render({ fixtureId: FIXTURE }, { product: "<script>" }))).toMatchObject({ productId: null });
  });
});
