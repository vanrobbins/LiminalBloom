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

  it("revokes blob URL and allows re-picking the same file", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    let callCount = 0;
    const createObjectURL = vi.fn(() => {
      callCount++;
      return `blob:preview${callCount}`;
    });
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    render(<ImagePicker productId={null} name="Tee" categoryName="Tees" imageKey={null} onChange={onChange} />);

    const file = new File(["big"], "photo.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText("Choose image") as HTMLInputElement;

    // Pick the file once
    await user.upload(input, file);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input.value).toBe(""); // Input was reset after upload
    expect(revokeObjectURL).not.toHaveBeenCalled(); // No revoke since preview was null

    // Pick the same file again — should work because input was reset
    await user.upload(input, file);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview1"); // Previous blob was revoked
  });
});
