// Shown while /company reads the company's regions, stores and recent changes. Inside the app shell the page's own
// header holds the title, so it does not jump (DECISIONS 10-10); a company person with no store has no shell and
// sees the same header on its own for the moment.

import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Company" />
      <Loader label="Loading the company…" />
    </div>
  );
}
