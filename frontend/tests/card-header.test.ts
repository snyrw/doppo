import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CardHeader } from "../app/components/CardShell";

describe("CardHeader", () => {
  it("shows 'Model: X' by default — unchanged for the six real cards", () => {
    const html = renderToStaticMarkup(CardHeader({ modelName: "gpt2", prompt: "Hello, world" }));
    expect(html).toContain("Model: gpt2");
    expect(html).toContain("Hello, world");
  });

  it("replaces the model line with `eyebrow`, dropping 'Model:' entirely", () => {
    const html = renderToStaticMarkup(CardHeader({ eyebrow: "Home / Doppo", prompt: "What is Doppo?" }));
    expect(html).toContain("Home / Doppo");
    expect(html).not.toContain("Model:");
  });

  it("omits the accent swatch when `accent` is not given", () => {
    const html = renderToStaticMarkup(CardHeader({ modelName: "gpt2", prompt: "hi" }));
    expect(html).not.toContain("background-color");
  });

  it("renders the accent swatch in the given color when `accent` is set", () => {
    const html = renderToStaticMarkup(
      CardHeader({ eyebrow: "Home / Doppo", prompt: "Attention Analysis", accent: "#ccb789" }),
    );
    expect(html).toContain("background-color:#ccb789");
  });
});
