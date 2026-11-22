// Shown while the Store panel reads the store's settings and its people. Renders inside the app
// shell, which already provides <main>; the page's own header, so the title does not jump (DECISIONS 10-10).

import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Store" />
      <Loader label="Loading the store…" />
    </div>
  );
}
