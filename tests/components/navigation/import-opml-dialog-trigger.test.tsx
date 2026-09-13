import ImportOpmlDialogTrigger from "@/components/navigation/import-opml-dialog-trigger";
import { importOpml } from "@/lib/repository/opmlRepository";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repository/opmlRepository", () => ({
  importOpml: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const openDialog = async () => {
  const user = userEvent.setup();
  render(
    <ImportOpmlDialogTrigger>
      <button>Import OPML</button>
    </ImportOpmlDialogTrigger>,
  );
  await user.click(screen.getByRole("button", { name: "Import OPML" }));
  return user;
};

const opmlFile = () =>
  new File(['<opml version="2.0"><body/></opml>'], "feeds.opml", {
    type: "text/xml",
  });

describe("ImportOpmlDialogTrigger", () => {
  it("keeps the Import button disabled until a file is chosen", async () => {
    const user = await openDialog();

    const importButton = screen.getByRole("button", { name: "Import" });
    expect(importButton).toBeDisabled();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());

    expect(importButton).toBeEnabled();
  });

  it("sends the chosen file to importOpml and shows the summary", async () => {
    vi.mocked(importOpml).mockResolvedValue({
      ok: true,
      imported: 12,
      skipped: 3,
      categoriesCreated: 2,
      unusable: ["Broken feed"],
    });
    const user = await openDialog();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText(
        "Imported 12 feeds. Skipped 3 you already had. 2 categories created.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Broken feed")).toBeInTheDocument();

    const formData = vi.mocked(importOpml).mock.calls[0][0];
    expect(formData.get("file")).toBeInstanceOf(File);
    expect((formData.get("file") as File).name).toBe("feeds.opml");
  });

  it("uses singular wording for one of something", async () => {
    vi.mocked(importOpml).mockResolvedValue({
      ok: true,
      imported: 1,
      skipped: 1,
      categoriesCreated: 1,
      unusable: [],
    });
    const user = await openDialog();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText(
        "Imported 1 feed. Skipped 1 you already had. 1 category created.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the action's error and keeps the form available", async () => {
    vi.mocked(importOpml).mockResolvedValue({
      ok: false,
      error: "This file is not an OPML document.",
    });
    const user = await openDialog();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText("This file is not an OPML document."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  it("shows a generic message when the action throws", async () => {
    vi.mocked(importOpml).mockRejectedValue(new Error("boom"));
    const user = await openDialog();

    await user.upload(screen.getByLabelText("OPML file"), opmlFile());
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText("Importing failed. Please try again."),
    ).toBeInTheDocument();
  });
});
