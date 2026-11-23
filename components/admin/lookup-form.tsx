// The people lookup's form: one exact email, sent as a GET so the result has its own address
// (/admin/people?email=). The server reads the email from the URL, never from a form post.

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LookupForm({ email }: { email: string }) {
  return (
    <form action="/admin/people" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Input
        label="Email"
        hint="The whole address. Capitals don't matter."
        type="email"
        name="email"
        defaultValue={email}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        required
        className="sm:max-w-sm sm:flex-1"
      />
      <Button type="submit" className="self-start">
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Look up
      </Button>
    </form>
  );
}
