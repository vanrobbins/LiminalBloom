// Shown while the roles editor loads. Without it, /store's loading screen (titled "Store") would
// cover this page too, and the title would jump (DECISIONS 10-10: loading renders the page's own
// header). Inside the app shell, which already provides <main>.

import { PageHeader } from "@/components/shell/page-header";
import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Roles and permissions" back={{ href: "/store", label: "Store" }} />
      <Loader label="Loading roles…" />
    </div>
  );
}
