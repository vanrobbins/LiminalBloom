// Shown while /search queries the database (§3.12.4). Renders inside the app
// shell, which already provides <main>.

import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return <Loader label="Loading search…" />;
}
