// Shown while a tab tap waits for the session (DECISIONS 10-10: loading.tsx renders the
// page's own header). Inside the app shell, which already provides <main>. It draws the page's
// own frame, search and loader box, so nothing moves when the page replaces it.

import { HomeSearch } from "@/components/home/home-search";
import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl md:max-w-5xl">
      <PageHeader title="Home" />
      <HomeSearch />
      <div className="min-h-64">
        <Loader label="Loading your store…" />
      </div>
    </div>
  );
}
