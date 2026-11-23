// Moving between steps on one page swaps the form the person was typing in for another, so focus falls to the
// page. Each step's heading takes it instead (a heading is not focusable by itself, hence tabIndex -1), the way
// components/admin/reason-dialog.tsx does after it closes.

/** Focuses the heading; no-op when it is not on the page. */
export function focusHeading(heading: HTMLElement | null | undefined): void {
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
}
