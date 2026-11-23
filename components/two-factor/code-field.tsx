// The field for a code: the six digits an authenticator app shows, or one of the ten backup codes.
// Shared by the sign-in code page, the admin step-up and the setup's last step (and Account in A3b).
// `autoComplete="one-time-code"` lets a phone offer the code; the numeric keypad is for the app code only,
// since a backup code has letters.

import { Input } from "@/components/ui/input";

export type CodeMethod = "totp" | "backup";

export function CodeField({ method = "totp", error, label }: { method?: CodeMethod; error?: string; label?: string }) {
  const backup = method === "backup";
  return (
    <Input
      label={label ?? (backup ? "Backup code" : "Code from your authenticator app")}
      name="code"
      required
      autoComplete="one-time-code"
      inputMode={backup ? "text" : "numeric"}
      maxLength={backup ? 32 : 6}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      hint={backup ? "Each backup code works once." : undefined}
      error={error}
    />
  );
}
