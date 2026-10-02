import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <main className="flex h-dvh items-center justify-center bg-surface">
      <Loader label="Opening the layout editor…" />
    </main>
  );
}
