// One person in the list. The buttons exist only where the server said the rank
// rule allows them (`canAct`); every other row is read-only.

import { Button } from "@/components/ui/button";
import type { PersonRow } from "@/lib/access/people-view";

type PersonRowProps = {
  person: PersonRow;
  /** The button is passed so focus can return to it when the dialog closes. */
  onChangeRole: (person: PersonRow, opener: HTMLElement) => void;
  onRemove: (person: PersonRow, opener: HTMLElement) => void;
};

export function PersonListItem({ person, onChangeRole, onRemove }: PersonRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 bg-raised px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-ink wrap-break-word">
          {person.name}
          {person.isYou ? <span className="font-normal text-ink-muted"> (you)</span> : null}
        </span>
        {person.email ? <span className="text-sm text-ink-muted wrap-break-word">{person.email}</span> : null}
      </span>
      {person.canAct ? (
        <>
          <Button variant="secondary" data-change-role={person.memberId} onClick={(event) => onChangeRole(person, event.currentTarget)} aria-label={`Change role for ${person.name}`}>
            Change role
          </Button>
          <Button variant="quiet-danger" onClick={(event) => onRemove(person, event.currentTarget)} aria-label={`Remove ${person.name}`}>
            Remove
          </Button>
        </>
      ) : null}
    </li>
  );
}
