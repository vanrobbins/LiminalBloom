// A row that is about to fold away takes the focus with it (it goes inert), and focus would
// drop to the page. This moves it first: to the next row's first control, else the previous
// row's, else the list's heading (when other rows stay), else the page title (the list and its
// heading go with the row). A heading takes focus only by script.

const CONTROL = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

function focusScripted(target: HTMLElement | null) {
  if (!target) return false;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus();
  return true;
}

export function focusNearRow(row: Element | null, heading: HTMLElement | null) {
  for (const side of ["nextElementSibling", "previousElementSibling"] as const) {
    for (let other = row?.[side]; other; other = other[side]) {
      if (other.hasAttribute("inert")) continue;
      const control = other.querySelector<HTMLElement>(CONTROL);
      if (control) return void control.focus();
    }
  }
  const othersStay = (row?.parentElement?.children.length ?? 0) > 1;
  if (othersStay && focusScripted(heading)) return;
  focusScripted(document.querySelector<HTMLElement>("h1"));
}
