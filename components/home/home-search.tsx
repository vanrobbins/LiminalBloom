// Home's search (0.7.0.6 spec section 3): the Products field inside a `next/form`
// GET to /products, so Enter (or a phone keyboard's search key) opens the results
// there. No submit button (the keyboard submits) and no autofocus (a phone's
// keyboard would cover the cards).

import Form from "next/form";

import { SearchField } from "@/components/search/search-field";

export function HomeSearch() {
  return (
    <Form action="/products" role="search" className="mb-6">
      <SearchField />
    </Form>
  );
}
