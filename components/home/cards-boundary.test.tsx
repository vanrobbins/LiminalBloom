import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ retry: vi.fn() }));

// next/error's catchError needs the App Router; stand in with a plain error
// boundary that hands the fallback the same (props, { error, retry }) shape.
vi.mock("next/error", async () => {
  const React = await import("react");
  return {
    catchError: (fallback: (props: object, info: { error: Error; retry: () => void; reset: () => void }) => React.ReactElement) =>
      class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
        state = { error: null as Error | null };
        static getDerivedStateFromError(error: Error) {
          return { error };
        }
        render() {
          const { error } = this.state;
          // Like Next's, the fallback renders as a component, so it may use hooks.
          const Fallback = () => fallback({}, { error: error as Error, retry: mocks.retry, reset: () => this.setState({ error: null }) });
          return error ? <Fallback /> : this.props.children;
        }
      },
  };
});

import { CardsBoundary } from "./cards-boundary";

function Boom(): never {
  throw new Error("db down");
}

describe("CardsBoundary", () => {
  it("shows the cards when nothing fails", () => {
    render(
      <CardsBoundary>
        <p>the cards</p>
      </CardsBoundary>,
    );
    expect(screen.getByText("the cards")).toBeInTheDocument();
  });

  it("replaces a failed read with one line and a worded Try again, and retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <CardsBoundary>
        <Boom />
      </CardsBoundary>,
    );
    expect(screen.getByText("Couldn't load this store's cards.")).toBeInTheDocument();
    expect(screen.queryByText("db down")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });
});
