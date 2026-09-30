// Shown while /products queries the database (§3.12.4: anything slower than
// about 400 ms names the work it is doing).

import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <main className="min-h-screen bg-surface px-4 py-16">
      <Loader label="Loading products…" />
    </main>
  );
}
