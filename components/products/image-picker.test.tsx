import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const resized = new Blob(["small"], { type: "image/webp" });
vi.mock("./resize-image", () => ({ resizeImage: vi.fn(async () => resized) }));

import { ImagePicker } from "./image-picker";

describe("ImagePicker", () => {
  it("shrinks a chosen photo and hands it on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:preview");
    globalThis.URL.revokeObjectURL = vi.fn();
    render(<ImagePicker productId={null} name="Tee" categoryName="Tees" imageKey={null} onChange={onChange} />);
    await user.upload(screen.getByLabelText("Choose image"), new File(["big"], "photo.jpg", { type: "image/jpeg" }));
    expect(onChange).toHaveBeenCalledWith(resized);
    expect(screen.getByRole("img", { name: "New image for Tee" })).toHaveAttribute("src", "blob:preview");
  });

  it("refuses a file that is not a photo", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    render(<ImagePicker productId={null} name="Tee" categoryName="Tees" imageKey={null} onChange={onChange} />);
    await user.upload(screen.getByLabelText("Choose image"), new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Use a JPEG, PNG or WebP image.")).toBeInTheDocument();
  });
});
