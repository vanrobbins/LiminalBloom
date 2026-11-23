// Turning two-factor on: three steps on one page (spec 0.7.1 8.3). Used for admins (/admin/two-factor)
// and, from A3b, for any account. The server actions are props, so each page passes the ones that
// carry its own guard. Never a QR code here (A3b adds one beside the typed key); the key is shown in
// groups of four with a Copy button, and an otpauth link opens a phone's authenticator app.
//
// The key and the codes live only in this component's state, from the action's reply to this person.

"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONNECTION_ERROR } from "@/lib/connection-error";
import type { ConfirmActionReply, Refused, StartActionReply, StartedReply } from "@/lib/two-factor/replies";
import { groupsOfFour } from "@/lib/two-factor/totp-key";

import { CodeField } from "./code-field";
import { CopyButton } from "./copy-button";

type Props = {
  /** One sentence under the heading: why this account is being asked. */
  intro: string;
  start: (password: string) => Promise<StartActionReply>;
  confirm: (code: string) => Promise<ConfirmActionReply>;
  /** Where to go once it is on. */
  doneHref: string;
};

export function TwoFactorSetup({ intro, start, confirm, doneHref }: Props) {
  const router = useRouter();
  const [started, setStarted] = useState<StartedReply | null>(null);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Runs one step: a refusal or a lost connection becomes the inline message; `onOk` runs on success. */
  async function run<R extends { status: string }>(work: () => Promise<R>, onOk: (reply: Exclude<R, { status: "refused" }>) => void) {
    setProblem(null);
    setPending(true);
    try {
      const reply = await work();
      if (reply.status === "refused") setProblem((reply as unknown as Refused).message);
      else onOk(reply as Exclude<R, { status: "refused" }>);
    } catch {
      setProblem(CONNECTION_ERROR);
    } finally {
      setPending(false);
    }
  }

  const askPassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    void run(() => start(password), setStarted);
  };

  const finish = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code")).trim();
    void run(
      () => confirm(code),
      () => {
        router.push(doneHref);
        router.refresh();
      },
    );
  };

  const alert = problem ? (
    <p role="alert" className="text-sm text-danger">
      {problem}
    </p>
  ) : null;

  if (!started) {
    return (
      <form onSubmit={askPassword} className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Turn on two-step sign-in</h1>
        <p className="text-ink-muted">{intro}</p>
        <Input label="Password" name="password" type="password" required autoComplete="current-password" hint="Your password, to make sure it is you." />
        {alert}
        <Button type="submit" loading={pending} loadingText="Checking…">
          Continue
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={finish} className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Turn on two-step sign-in</h1>

      <section className="flex flex-col gap-2" aria-labelledby="setup-key">
        <h2 id="setup-key" className="text-lg font-semibold text-ink">
          Add it to your authenticator app
        </h2>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-words rounded border border-line bg-surface px-3 py-2 font-mono text-base text-ink">{groupsOfFour(started.setupKey)}</code>
          <CopyButton text={started.setupKey} label="Copy setup key" />
        </div>
        <Button asChild variant="secondary" className="self-start">
          <a href={started.otpauthUri}>Open in authenticator app</a>
        </Button>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="backup-codes">
        <h2 id="backup-codes" className="text-lg font-semibold text-ink">
          Backup codes
        </h2>
        <p className="text-sm text-ink-muted">If you lose your phone, each of these signs you in once.</p>
        <div className="flex items-start gap-2">
          <ul className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1 rounded border border-line bg-surface px-3 py-2 font-mono text-sm text-ink">
            {started.backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <CopyButton text={started.backupCodes.join("\n")} label="Copy backup codes" />
        </div>
        {/* The real checkbox is the 44 px row, see-through and on top; the box beside it is only the picture of it. */}
        <label className="group relative flex min-h-11 items-center gap-3 text-ink">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="peer absolute inset-0 h-11 w-full cursor-pointer opacity-0" />
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded border border-line bg-raised group-has-checked:border-brand group-has-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
          >
            <Check strokeWidth={2.5} className="size-4 text-on-brand opacity-0 group-has-checked:opacity-100" />
          </span>
          I saved these codes somewhere safe.
        </label>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="first-code">
        <h2 id="first-code" className="text-lg font-semibold text-ink">
          Enter a code to finish
        </h2>
        <CodeField />
      </section>

      {alert}
      <Button type="submit" disabled={!saved} loading={pending} loadingText="Checking…">
        Turn on two-step sign-in
      </Button>
    </form>
  );
}

