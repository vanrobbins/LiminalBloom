// Shown while the Quick Adjust page reads the planogram and its adjustment. Renders inside the app shell, which already
// provides <main>.

import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Quick Adjust" />
      <Loader label="Loading Quick Adjust…" />
    </div>
  );
}
