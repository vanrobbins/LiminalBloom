// The Products search field, shared by the Products screen and Home's search
// (0.7.0.6 spec section 3): one label, hint and set of attributes, so the two
// can't drift. Each caller passes what differs (value, onChange, ref, or nothing).

import { Input } from "@/components/ui/input";

type SearchFieldProps = Omit<React.ComponentProps<typeof Input>, "label" | "hint" | "type" | "name" | "autoComplete" | "enterKeyHint">;

export function SearchField(props: SearchFieldProps) {
  return <Input {...props} label="Search products" type="search" name="q" hint="Name, style number, category or color." autoComplete="off" enterKeyHint="search" />;
}
