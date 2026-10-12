// Shown while the layout loads (§3.12.4: slow work names itself).

import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <>
      <PageHeader title="Store layout" />
      <Loader label="Loading the store layout…" />
    </>
  );
}
