// Picks the demo screen for the current route.

"use client";

import { useNav } from "../demo-nav";
import { AccountScreen } from "./account-screen";
import { HomeScreen } from "./home-screen";
import { LayoutScreen } from "./layout-screen";
import { PlanogramListScreen } from "./planogram-list-screen";
import { PlanogramScreen } from "./planogram-screen";
import { ProductsScreen } from "./products-screen";
import { QuickAdjustScreen } from "./quick-adjust-screen";

export function DemoScreen() {
  const { route } = useNav();
  switch (route.name) {
    case "home":
      return <HomeScreen />;
    case "products":
      return <ProductsScreen />;
    case "layout":
      return <LayoutScreen key={route.fixtureId ?? "map"} fixtureId={route.fixtureId} />;
    case "planograms":
      return <PlanogramListScreen />;
    case "planogram":
      // Keyed so opening another fixture starts with its own face and selection.
      return <PlanogramScreen key={`${route.fixtureId}-${route.selectId ?? ""}`} {...route} />;
    case "quick-adjust":
      return <QuickAdjustScreen key={route.placementId ?? "list"} placementId={route.placementId} />;
    case "account":
      return <AccountScreen />;
  }
}
