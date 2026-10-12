// Shown while /search queries the database (§3.12.4). Renders inside the app
// shell, which already provides <main>.

import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <>
      <PageHeader title="Search" />
      <Loader label="Loading search…" />
    </>
  );
}
