// The editor tells the server which store it loaded. That id is never used to
// scope anything (CODESTYLE rule 8). It only detects a store switched in
// another tab, so this tab's changes cannot land in the wrong store
// (Review Focus 1).

export function checkStore(requested: string, active: string): "ok" | "store-changed" {
  return requested === active ? "ok" : "store-changed";
}
