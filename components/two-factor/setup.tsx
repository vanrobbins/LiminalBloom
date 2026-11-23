// Turning two-factor on: three steps on one page (spec 0.7.1 8.3). Used for admins (/admin/two-factor)
// and, from A3b, for any account (Account and the required-setup page). The server actions are props, so
// each page passes the ones that carry its own guard. The QR code is an SVG the server drew from the
// otpauth link (lib/two-factor/qr.ts); the typed key sits below it in groups of four with a Copy button,
// and the link opens a phone's authenticator app.
//
// The key and the codes live only in this component's state, from the action's reply to this person.

"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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
  /** The heading level of the title: 1 on a page of its own, 2 inside another page (its sections drop one with it). */
  level?: 1 | 2;
};

export function TwoFactorSetup({ intro, start, confirm, doneHref, level = 1 }: Props) {
  const Title = level === 1 ? "h1" : "h2";
  const Section = level === 1 ? "h2" : "h3";
  const router = useRouter();
  const [started, setStarted] = useState<StartedReply | null>(null);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Single flight: a second submit before the first answers (a double click, Enter twice) would run the step
  // twice; for the confirm each run deletes the other's new session. State is too slow for that, a ref is not.
  const busy = useRef(false);

  /** Runs one step: a refusal or a lost connection becomes the inline message; `onOk` runs on success. */
  async function run<R extends { status: string }>(work: () => Promise<R>, onOk: (reply: Exclude<R, { status: "refused" }>) => void) {
    if (busy.current) return;
    busy.current = true;
    setProblem(null);
    setPending(true);
    try {
      const reply = await work();
      if (reply.status === "refused") setProblem((reply as unknown as Refused).message);
      else onOk(reply as Exclude<R, { status: "refused" }>);
    } catch {
      setProblem(CONNECTION_ERROR);
    } finally {
      busy.current = false;
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
        <Title className={level === 1 ? "text-3xl font-semibold tracking-tight text-ink" : "text-lg font-semibold text-ink"}>Turn on two-step sign-in</Title>
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
      <Title className={level === 1 ? "text-3xl font-semibold tracking-tight text-ink" : "text-lg font-semibold text-ink"}>Turn on two-step sign-in</Title>

      <section className="flex flex-col gap-2" aria-labelledby="setup-key">
        <Section id="setup-key" className="text-lg font-semibold text-ink">
          Add it to your authenticator app
        </Section>
        {started.qrSvg ? (
          // A picture, not markup: an <img> never runs anything inside the SVG. White behind it so the code scans in dark mode.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/svg+xml;utf8,${encodeURIComponent(started.qrSvg)}`} alt="QR code for your authenticator app" className="size-44 self-center rounded bg-white p-1" />
        ) : null}
        <p className="text-sm text-ink-muted">Scan the code, or type the setup key.</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-words rounded border border-line bg-surface px-3 py-2 font-mono text-base text-ink">{groupsOfFour(started.setupKey)}</code>
          <CopyButton text={started.setupKey} label="Copy setup key" />
        </div>
        <Button asChild variant="secondary" className="self-start">
          <a href={started.otpauthUri}>Open in authenticator app</a>
        </Button>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="backup-codes">
        <Section id="backup-codes" className="text-lg font-semibold text-ink">
          Backup codes
        </Section>
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
        <Section id="first-code" className="text-lg font-semibold text-ink">
          Enter a code to finish
        </Section>
        <CodeField />
      </section>

      {alert}
      <Button type="submit" disabled={!saved} loading={pending} loadingText="Checking…">
        Turn on two-step sign-in
      </Button>
    </form>
  );
}

