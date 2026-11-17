import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ device: vi.fn(() => "America/Chicago") }));
vi.mock("@/lib/time/format", () => ({ deviceTimezone: mocks.device }));

import { TimezonePicker } from "./timezone-picker";

beforeEach(() => mocks.device.mockReturnValue("America/Chicago"));

const trigger = () => screen.getByRole("button", { name: /^Time zone/ });
const search = () => screen.getByRole("combobox", { name: "Find a time zone" });

async function open(props: Partial<React.ComponentProps<typeof TimezonePicker>> = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<TimezonePicker name="timezone" defaultZone="America/Los_Angeles" onChange={onChange} {...props} />);
  await user.click(trigger());
  return { user, onChange };
}

describe("TimezonePicker", () => {
  it("is one button naming the current zone, under a visible Time zone label", () => {
    render(<TimezonePicker name="timezone" defaultZone="America/Chicago" />);
    expect(screen.getByLabelText("Time zone")).toBe(trigger());
    expect(trigger()).toHaveTextContent("Central (America/Chicago)");
    expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens a search box with focus and a listbox it controls, US zones first", async () => {
    await open();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(search()).toHaveFocus();
    expect(search()).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    expect(screen.getAllByRole("group")[0]).toHaveAccessibleName("United States");
    expect(screen.getAllByRole("group")[1]).toHaveAccessibleName("Everywhere else");
    expect(screen.getByRole("option", { name: "Pacific (America/Los Angeles)" })).toHaveAttribute("aria-selected", "true");
  });

  it("holds the zone in a hidden input, so a form submits it", () => {
    const { container } = render(<TimezonePicker name="timezone" defaultZone="America/Denver" />);
    expect(container.querySelector("input[type=hidden][name=timezone]")).toHaveValue("America/Denver");
  });

  it("arrowing moves the active option and does not choose", async () => {
    const { user, onChange } = await open();
    const active = () => document.getElementById(search().getAttribute("aria-activedescendant")!);
    // The list opens on the current zone.
    expect(active()).toHaveAccessibleName("Pacific (America/Los Angeles)");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(active()).toHaveAccessibleName("Arizona (America/Phoenix)");
    await user.keyboard("{ArrowUp}");
    expect(active()).toHaveAccessibleName("Mountain (America/Denver)");
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent("Pacific (America/Los Angeles)");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Home and End jump the active option to the first and last, choosing nothing", async () => {
    const { user, onChange } = await open();
    const active = () => document.getElementById(search().getAttribute("aria-activedescendant")!);
    const options = screen.getAllByRole("option");
    await user.keyboard("{End}");
    expect(active()).toBe(options[options.length - 1]);
    await user.keyboard("{Home}");
    expect(active()).toBe(options[0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Enter while an IME is composing does not choose", async () => {
    const { onChange } = await open();
    fireEvent.keyDown(search(), { key: "Enter", isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Enter chooses the active option once, closes, and returns focus to the button", async () => {
    const { user, onChange } = await open();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("America/Denver");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger()).toHaveTextContent("Mountain (America/Denver)");
    expect(trigger()).toHaveFocus();
  });

  it("a click chooses once and returns focus to the button", async () => {
    const { user, onChange } = await open();
    await user.click(screen.getByRole("option", { name: "Eastern (America/New York)" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("America/New_York");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it("picking the zone already set closes without a change", async () => {
    const { user, onChange } = await open();
    await user.click(screen.getByRole("option", { name: "Pacific (America/Los Angeles)" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("suggests this device's zone on top, and picking it chooses that zone", async () => {
    const { user, onChange } = await open();
    const top = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    expect(top).toHaveTextContent("This device: Central (America/Chicago)");
    await user.click(top);
    expect(onChange).toHaveBeenCalledWith("America/Chicago");
  });

  it("does not suggest the device's zone when it is the current one or not a known zone", async () => {
    mocks.device.mockReturnValue("America/Los_Angeles");
    const first = await open();
    expect(screen.queryByText(/This device/)).toBeNull();
    await first.user.keyboard("{Escape}");
    mocks.device.mockReturnValue("Mars/Olympus_Mons");
    await first.user.click(trigger());
    expect(screen.queryByText(/This device/)).toBeNull();
  });

  it("narrows the list as you type, and keeps the device suggestion only if it fits", async () => {
    const { user, onChange } = await open();
    await user.type(search(), "london");
    expect(screen.getByRole("option", { name: "Europe/London" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Pacific (America/Los Angeles)" })).toBeNull();
    expect(screen.queryByText(/This device/)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("Europe/London");
  });

  it("says so when nothing matches", async () => {
    const { user } = await open();
    await user.type(search(), "zzzz");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByText(/No time zone matches/)).toBeInTheDocument();
    expect(search()).not.toHaveAttribute("aria-activedescendant");
  });

  it("draws only the first 50 matches and says to keep typing", async () => {
    await open();
    expect(screen.getAllByRole("option")).toHaveLength(51); // 50 matches and the device suggestion
    expect(screen.getByText("Keep typing to narrow the list.")).toBeInTheDocument();
  });

  it("Escape closes and returns focus to the button, choosing nothing", async () => {
    const { user, onChange } = await open();
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger()).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("follows `value` when the caller holds the zone", async () => {
    const { user, onChange } = await open({ value: "America/Denver" });
    expect(trigger()).toHaveTextContent("Mountain (America/Denver)");
    await user.click(screen.getByRole("option", { name: "Eastern (America/New York)" }));
    expect(onChange).toHaveBeenCalledWith("America/New_York");
    expect(trigger()).toHaveTextContent("Mountain (America/Denver)");
  });

  describe("on a phone", () => {
    const real = window.matchMedia;
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = real;
    });

    it("opens a bottom sheet with the search focused; choosing closes it and returns focus to the button", async () => {
      const { user, onChange } = await open();
      expect(screen.getByRole("dialog", { name: "Choose a time zone" })).toBeVisible();
      expect(search()).toHaveFocus();
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(onChange).not.toHaveBeenCalled();
      await user.keyboard("{Enter}");
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("America/Phoenix");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(trigger()).toHaveFocus();
    });
  });
});
