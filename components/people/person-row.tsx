// One person in the list. The buttons exist only where the server said the rank
// rule allows them (`canAct`); every other row is read-only.

import { UserMinus, UserRoundCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CollapseItem } from "@/components/ui/collapse-item";
import type { PersonRow } from "@/lib/access/people-view";

type PersonRowProps = {
  person: PersonRow;
  /** The button is passed so focus can return to it when the dialog closes. */
  onChangeRole: (person: PersonRow, opener: HTMLElement) => void;
  onRemove: (person: PersonRow, opener: HTMLElement) => void;
  /** Removed: the row folds shut before the list reloads without it. */
  leaving?: boolean;
  /** Said on the row when the reload after a removal failed. */
  problem?: string;
};

export function PersonListItem({ person, onChangeRole, onRemove, leaving = false, problem }: PersonRowProps) {
  return (
    <CollapseItem leaving={leaving} className="flex flex-wrap items-center gap-3 bg-raised px-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-ink wrap-break-word">
          {person.name}
          {person.isYou ? <span className="font-normal text-ink-muted"> (you)</span> : null}
        </span>
        {person.email ? <span className="text-sm text-ink-muted wrap-break-word">{person.email}</span> : null}
      </span>
      <span data-person-role className="shrink-0 text-sm text-ink-muted">
        {person.roleName}
      </span>
      {person.canAct ? (
        <>
          <Button icon variant="secondary" data-change-role={person.memberId} onClick={(event) => onChangeRole(person, event.currentTarget)} aria-label={`Change role for ${person.name}`}>
            <UserRoundCog aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Button>
          <Button icon variant="quiet-danger" onClick={(event) => onRemove(person, event.currentTarget)} aria-label={`Remove ${person.name}`}>
            <UserMinus aria-hidden="true" strokeWidth={1.75} className="size-5" />
          </Button>
        </>
      ) : null}
      {problem ? (
        <p aria-hidden="true" className="w-full text-sm text-danger">
          {problem}
        </p>
      ) : null}
    </CollapseItem>
  );
}
