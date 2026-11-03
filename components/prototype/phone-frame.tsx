// A phone drawn around a screen: either the chapter's drawing or the working
// demo. The caption says which, so nobody mistakes a drawing for the app.

export function PhoneFrame({ label, caption, children }: { label: string; caption: string; children: React.ReactNode }) {
  return (
    <figure className="mx-auto w-full max-w-80">
      <div className="rounded-[2.5rem] border border-line bg-raised p-2.5 shadow-xl">
        <div
          role="group"
          aria-label={label}
          className="relative flex h-[38rem] flex-col overflow-hidden rounded-[2rem] border border-line-subtle bg-surface"
        >
          {children}
        </div>
      </div>
      <figcaption className="mt-3 text-center text-sm text-ink-muted">{caption}</figcaption>
    </figure>
  );
}
