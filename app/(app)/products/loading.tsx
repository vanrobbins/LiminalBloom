// Shown while /products queries the database (§3.12.4: anything slower than
// about 400 ms names the work it is doing). Renders inside the app shell,
// which already provides <main>.

import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <>
      <PageHeader title="Product library" />
      <Loader label="Loading products…" />
    </>
  );
}
