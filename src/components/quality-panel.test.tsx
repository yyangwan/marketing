import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { toast } from "sonner";
import { QualityPanel } from "@/components/quality-panel";
import { createContext } from 'react';
import "@testing-library/jest-dom";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Simple router mock context
const RouterContext = createContext({
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
});

const RouterProvider = ({ children }: { children: React.ReactNode }) => (
  <RouterContext.Provider value={RouterContext.current}>
    {children}
  </RouterContext.Provider>
);

describe("QualityPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render collapsed by default", () => {
    render(
      <RouterProvider>
        <QualityPanel contentPieceId="test-content" />
      </RouterProvider>
    );
    expect(screen.getByText("内容质量评估")).toBeInTheDocument();
  });

  it("should fetch and show quality scores after expanding", async () => {
    const mockQuality = {
      quality: 8,
      engagement: 7,
      brandVoice: 9,
      platformFit: 8,
      suggestions: "", // Empty string is valid (will parse as [])
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuality,
    });

    render(
      <RouterProvider>
        <QualityPanel contentPieceId="test-content" />
      </RouterProvider>
    );

    // Click the button to expand and trigger fetch
    const expandButton = screen.getByText("内容质量评估");

    // Use act to ensure React processes all state updates
    await act(async () => {
      fireEvent.click(expandButton);
    });

    // Wait for the content to appear
    await waitFor(() => {
      // Average score is (8+7+9+8)/4 = 8
      expect(screen.getByText("8/10")).toBeInTheDocument();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(screen.getByText("内容质量")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("should show score labels correctly", async () => {
    const mockQuality = {
      quality: 9,
      engagement: 8,
      brandVoice: 10,
      platformFit: 8,
      suggestions: "",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuality,
    });

    render(
      <RouterProvider>
        <QualityPanel contentPieceId="test-content" />
      </RouterProvider>
    );

    const expandButton = screen.getByText("内容质量评估");
    fireEvent.click(expandButton);

    await waitFor(() => {
      // Use getAllByText since multiple score cards may have the same label
      expect(screen.getAllByText("优秀").length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should show '良好' for medium scores", async () => {
    const mockQuality = {
      quality: 7,
      engagement: 7,
      brandVoice: 6,
      platformFit: 7,
      suggestions: "",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuality,
    });

    render(
      <RouterProvider>
        <QualityPanel contentPieceId="test-content" />
      </RouterProvider>
    );

    const expandButton = screen.getByText("内容质量评估");
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getAllByText("良好").length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should show '需改进' for low scores", async () => {
    const mockQuality = {
      quality: 4,
      engagement: 4,
      brandVoice: 5,
      platformFit: 4,
      suggestions: "",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuality,
    });

    render(
      <RouterProvider>
        <QualityPanel contentPieceId="test-content" />
      </RouterProvider>
    );

    const expandButton = screen.getByText("内容质量评估");
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getAllByText("需改进").length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should show suggestions when available", async () => {
    const mockQuality = {
      quality: 6,
      engagement: 5,
      brandVoice: 6,
      platformFit: 7,
      suggestions: JSON.stringify([
        "Consider adding more examples",
        "Stronger call-to-action needed"
      ]),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockQuality,
    });

    render(
      <RouterProvider>
        <QualityPanel contentPieceId="test-content" />
      </RouterProvider>
    );

    const expandButton = screen.getByText("内容质量评估");
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText("优化建议")).toBeInTheDocument();
      expect(screen.getByText("Consider adding more examples")).toBeInTheDocument();
    });
  });

  it("should handle API errors gracefully", async () => {
    // Mock a failed response with json() method that returns an error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    render(
      <RouterProvider>
        <QualityPanel contentPieceId="test-content" />
      </RouterProvider>
    );

    const expandButton = screen.getByText("内容质量评估");
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    }, { timeout: 3000 });
  });
});
