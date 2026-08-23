import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SellerDeleteDraftDialog } from "./seller-delete-draft-dialog";

describe("Seller draft deletion confirmation", () => {
  it("does not render until deletion is requested", () => {
    render(<SellerDeleteDraftDialog open={false} pending={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains permanence and Cancel does not confirm", async () => {
    const cancel = vi.fn();
    const confirm = vi.fn();
    render(<SellerDeleteDraftDialog open pending={false} onCancel={cancel} onConfirm={confirm} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Delete this draft?");
    expect(screen.getByText(/uploaded photos\/documents will be permanently removed/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("confirms once and disables both actions while pending", async () => {
    const confirm = vi.fn();
    const view = render(<SellerDeleteDraftDialog open pending={false} onCancel={vi.fn()} onConfirm={confirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(confirm).toHaveBeenCalledOnce();
    view.rerender(<SellerDeleteDraftDialog open pending error="Safe retry message" onCancel={vi.fn()} onConfirm={confirm} />);
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Safe retry message");
  });
});
