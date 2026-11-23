// /help/new?kind=&from= (spec 0.7.1 9.2): the form. `kind` and `from` only preselect and hint; the form's
// `from` is cleaned here and again by the action, and the context is the server's.

import { HelpForm } from "@/components/help/help-form";
import { HelpFrame } from "@/components/help/help-frame";
import { requireSignedIn } from "@/lib/current-member";
import { cleanFrom } from "@/lib/help/context";
import { ASKABLE_KINDS, askableKind } from "@/lib/help/kinds";

export const dynamic = "force-dynamic";

type Param = string | string[] | undefined;
const one = (value: Param) => (Array.isArray(value) ? value[0] : value);

export default async function NewHelpPage({ searchParams }: { searchParams: Promise<{ kind?: Param; from?: Param }> }) {
  const current = await requireSignedIn();
  const query = await searchParams;
  return (
    <HelpFrame kind={current.kind} title="Ask Liminal Bloom" back={{ href: "/help", label: "Help" }}>
      <HelpForm kinds={ASKABLE_KINDS} initialKind={askableKind(one(query.kind)) ?? "account"} from={cleanFrom(one(query.from))} />
    </HelpFrame>
  );
}
