import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SEOScorer } from "@/components/seo-scorer";
import "@testing-library/jest-dom";

describe("SEOScorer", () => {
  it("should render collapsed by default", () => {
    const { container } = render(<SEOScorer content="" />);
    expect(container.querySelector("button")).toBeInTheDocument();
  });

  it("should calculate character count correctly", async () => {
    const { container } = render(<SEOScorer content="Hello world" />);

    const button = container.querySelector("button");
    await act(async () => {
      if (button) button.click();
    });

    await new Promise((r) => setTimeout(r, 350));

    expect(container.textContent).toContain("11");
  });

  it("should calculate word count correctly", async () => {
    const { container } = render(<SEOScorer content="Hello world test" />);

    const button = container.querySelector("button");
    await act(async () => {
      if (button) button.click();
    });

    await new Promise((r) => setTimeout(r, 350));

    expect(container.textContent).toContain("3");
  });

  it("should calculate keyword density", async () => {
    const { container } = render(
      <SEOScorer content="SEO is important for SEO optimization" />
    );

    const button = container.querySelector("button");
    await act(async () => {
      if (button) button.click();
    });

    const input = container.querySelector('input[type="text"]');
    await act(async () => {
      if (input) {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await new Promise((r) => setTimeout(r, 350));

    expect(container.textContent).toContain("出现");
  });

  it("should show SEO analysis panel", async () => {
    const { container } = render(<SEOScorer content="SEO content example" />);

    const button = container.querySelector("button");
    await act(async () => {
      if (button) button.click();
    });

    await new Promise((r) => setTimeout(r, 350));

    // Should show SEO analysis panel
    expect(container.textContent).toContain("SEO 分析");
  });

  it("should calculate overall score", async () => {
    const testContent = "A".repeat(500);
    const { container } = render(<SEOScorer content={testContent} />);

    const button = container.querySelector("button");
    await act(async () => {
      if (button) button.click();
    });

    await new Promise((r) => setTimeout(r, 350));

    const scoreMatch = container.textContent?.match(/(\d+)\/100/);
    expect(scoreMatch).toBeTruthy();
    const score = parseInt(scoreMatch?.[1] || "0");
    expect(score).toBeGreaterThan(50);
  });
});
