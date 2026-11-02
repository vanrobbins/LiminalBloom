// Picks the drawing for a chapter's screen.

import type { ScreenId } from "@/lib/prototype/types";

import { AiConnectionScreen } from "./screens/ai-connection-screen";
import { ChecklistScreen } from "./screens/checklist-screen";
import { CoreLoopScreen } from "./screens/core-loop-screen";
import { FrameRunScreen } from "./screens/frame-run-screen";
import { HomeScreen } from "./screens/home-screen";
import { LocatorScreen } from "./screens/locator-screen";
import { MyDayScreen } from "./screens/my-day-screen";
import { PaletteScreen } from "./screens/palette-screen";
import { PlanogramScreen } from "./screens/planogram-screen";
import { ProductsScreen } from "./screens/products-screen";
import { QuickAdjustScreen } from "./screens/quick-adjust-screen";
import { RequestPathScreen } from "./screens/request-path-screen";
import { ReviewScreen } from "./screens/review-screen";
import { SignInScreen } from "./screens/sign-in-screen";
import { SpaceScreen } from "./screens/space-screen";
import { StoreMapScreen } from "./screens/store-map-screen";

const SCREENS: Record<ScreenId, () => React.ReactNode> = {
  "core-loop": CoreLoopScreen,
  "sign-in": SignInScreen,
  "store-map": StoreMapScreen,
  products: ProductsScreen,
  locator: LocatorScreen,
  planogram: PlanogramScreen,
  space: SpaceScreen,
  "frame-run": FrameRunScreen,
  palette: PaletteScreen,
  home: HomeScreen,
  "quick-adjust": QuickAdjustScreen,
  review: ReviewScreen,
  "my-day": MyDayScreen,
  checklist: ChecklistScreen,
  "ai-connection": AiConnectionScreen,
  "request-path": RequestPathScreen,
};

export function ChapterScreen({ id }: { id: ScreenId }) {
  const Screen = SCREENS[id];
  return <Screen />;
}
