import KeywordListField from "@/components/feed/keyword-list-field";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const setup = (value: string[] = []) => {
  const onChange = vi.fn();
  render(
    <KeywordListField
      value={value}
      onChange={onChange}
      inputLabel="Add a keyword"
    />,
  );
  return { onChange };
};

describe("KeywordListField", () => {
  it("adds the typed entry when Enter is pressed", async () => {
    const { onChange } = setup();

    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "USB driver development{Enter}",
    );

    expect(onChange).toHaveBeenCalledWith(["USB driver development"]);
  });

  it("keeps spaces, so a whole sentence can be entered", async () => {
    const { onChange } = setup();

    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "anything that reads like a press release{Enter}",
    );

    expect(onChange).toHaveBeenCalledWith([
      "anything that reads like a press release",
    ]);
  });

  it("trims the entry", async () => {
    const { onChange } = setup();

    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "  x  {Enter}",
    );

    expect(onChange).toHaveBeenCalledWith(["x"]);
  });

  it("ignores an entry that is empty once trimmed", async () => {
    const { onChange } = setup();

    await userEvent.type(screen.getByLabelText("Add a keyword"), "   {Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores a case-insensitive duplicate", async () => {
    const { onChange } = setup(["Crypto"]);

    await userEvent.type(
      screen.getByLabelText("Add a keyword"),
      "crypto{Enter}",
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes an entry when its remove button is clicked", async () => {
    const { onChange } = setup(["kernel", "usb"]);

    await userEvent.click(screen.getByRole("button", { name: "Remove usb" }));

    expect(onChange).toHaveBeenCalledWith(["kernel"]);
  });

  it("clears the input after adding", async () => {
    setup();
    const input = screen.getByLabelText("Add a keyword");

    await userEvent.type(input, "kernel{Enter}");

    expect((input as HTMLInputElement).value).toBe("");
  });
});
