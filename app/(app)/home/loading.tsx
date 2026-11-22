// Shown while a tab tap waits for the session (DECISIONS 10-10: loading.tsx renders the
// page's own header). Inside the app shell, which already provides <main>.

import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <>
      <PageHeader title="Home" />
      <Loader label="Loading your store…" />
    </>
  );
}
