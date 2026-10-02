// Shown while the layout loads (§3.12.4: slow work names itself).

import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return <Loader label="Loading the store layout…" />;
}
