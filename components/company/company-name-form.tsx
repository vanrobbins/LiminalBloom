// The company's name on /company: a field that saves on blur or Enter once it is a valid name (2 to 60
// characters), with the save indicator beside it and no Save button (R3). The page reloads after a save so the
// header and the store switcher show the new name. The name the page showed is sent too, so a rename made on
// another device is told, not overwritten.

"use client";

import { useEffect, useRef, useState } from "react";

import { renameCompanyAction } from "@/app/(app)/company/actions";
import { PanelSaveLine } from "@/components/planograms/panel-save-line";
import { Input } from "@/components/ui/input";
import { useInlineSave } from "@/components/ui/use-inline-save";
import { cleanCompanyName, MAX_COMPANY_NAME, MIN_COMPANY_NAME } from "@/lib/companies/limits";

const LENGTH = `Give the company a name of ${MIN_COMPANY_NAME} to ${MAX_COMPANY_NAME} characters.`;

export function CompanyNameForm({ name }: { name: string }) {
  const { status, save, busy } = useInlineSave();
  const [problem, setProblem] = useState<string | undefined>(undefined);
  // The field follows the stored name: put back after a refusal, and again when the reload brings the current one.
  const [value, setValue] = useState(name);
  const [known, setKnown] = useState(name);
  if (known !== name) {
    setKnown(name);
    setValue(name);
  }
  // The name last sent (or shown): blur after Enter, or a second blur, sends nothing.
  const sent = useRef(name);
  useEffect(() => {
    sent.current = name;
  }, [name]);

  async function commit(raw: string) {
    const clean = cleanCompanyName(raw);
    if (clean === null) return setProblem(LENGTH);
    setProblem(undefined);
    if (clean === sent.current) return;
    const before = sent.current;
    sent.current = clean;
    const reply = await save(() => renameCompanyAction(clean, name));
    if (reply?.status === "saved") return;
    // A lost connection may be tried again on the next blur; a refusal is the stored name's to correct.
    sent.current = before;
    if (reply) {
      setProblem(reply.message);
      setValue(name);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        void commit(String(new FormData(event.currentTarget).get("name") ?? ""));
      }}
    >
      {/* Read-only (not disabled) while it saves, to keep focus. */}
      <Input
        label="Company name"
        name="name"
        value={value}
        maxLength={MAX_COMPANY_NAME}
        autoComplete="off"
        readOnly={busy}
        error={problem}
        onChange={(event) => {
          setValue(event.target.value);
          setProblem(undefined);
        }}
        onBlur={(event) => void commit(event.target.value)}
      />
      <PanelSaveLine status={status} />
    </form>
  );
}
