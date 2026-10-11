import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getRedirectError } from "next/dist/client/components/redirect";
import { Component, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createStore: vi.fn() }));
vi.mock("./actions", () => ({ createStore: mocks.createStore }));

import { CreateStoreForm } from "./form";

// Catches what the form rethrows, standing in for Next's own handler.
class Boundary extends Component<{ children: ReactNode }, { caught: unknown }> {
  state = { caught: null as unknown };
  static getDerivedStateFromError(caught: unknown) {
    return { caught };
  }
  render() {
    return this.state.caught ? <p data-testid="boundary">rethrown</p> : this.props.children;
  }
}

async function submit() {
  const user = userEvent.setup();
  render(
    <Boundary>
      <CreateStoreForm />
    </Boundary>,
  );
  await user.type(screen.getByLabelText("Store name"), "Pioneer Place");
  await user.click(screen.getByRole("button", { name: "Create store" }));
}

describe("CreateStoreForm", () => {
  it("a thrown request clears the button and names the connection", async () => {
    mocks.createStore.mockRejectedValue(new TypeError("Failed to fetch"));
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server. Check the connection and try again.");
    expect(screen.getByRole("button", { name: "Create store" })).toBeEnabled();
  });

  it("shows the error the action returns", async () => {
    mocks.createStore.mockResolvedValue({ error: "Name taken" });
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Name taken");
  });

  it("lets a redirect through instead of calling it a connection error", async () => {
    mocks.createStore.mockRejectedValue(getRedirectError("/products", "push"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await submit();
    expect(await screen.findByTestId("boundary")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    errors.mockRestore();
  });
});
