// A phone drawn around a mock screen. The caption says plainly that this is
// a drawing, so nobody tries to use it as the app.

export function PhoneFrame({ label, children }: { label: string; children: React.ReactNode }) {
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
      <figcaption className="mt-3 text-center text-sm text-ink-muted">
        A drawing of the screen, not the working app. Tap a number.
      </figcaption>
    </figure>
  );
}
