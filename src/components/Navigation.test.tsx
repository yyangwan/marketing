import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Navigation from "./Navigation";
import "@testing-library/jest-dom";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

describe("Navigation", () => {
  const mockProjects = [
    { id: "p1", name: "Project A" },
    { id: "p2", name: "Project B" },
  ];

  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("should render main navigation items", () => {
    render(<Navigation projects={mockProjects} />);

    expect(screen.getByText("看板")).toBeInTheDocument();
    expect(screen.getByText("日历")).toBeInTheDocument();
    expect(screen.getByText("数据统计")).toBeInTheDocument();
    expect(screen.getByText("新建 Brief")).toBeInTheDocument();
  });

  it("should render project list", () => {
    render(<Navigation projects={mockProjects} />);

    expect(screen.getByText("项目")).toBeInTheDocument();
    expect(screen.getByText("Project A")).toBeInTheDocument();
    expect(screen.getByText("Project B")).toBeInTheDocument();
  });

  it("should render empty state when no projects", () => {
    render(<Navigation projects={[]} />);

    expect(screen.getByText("项目")).toBeInTheDocument();
    // No project names should be rendered
    expect(screen.queryByText("Project A")).not.toBeInTheDocument();
  });

  it("should highlight active main nav item", () => {
    vi.mocked(usePathname).mockReturnValue("/calendar");

    const { container } = render(<Navigation projects={mockProjects} />);

    // Calendar link should have active class
    const links = container.querySelectorAll("a");
    const calendarLink = Array.from(links).find(
      (link) => link.getAttribute("href") === "/calendar"
    );

    expect(calendarLink?.className).toContain("bg-sidebar-accent");
    expect(calendarLink?.className).toContain("font-medium");
  });

  it("should not highlight inactive main nav items", () => {
    vi.mocked(usePathname).mockReturnValue("/brief/new");

    const { container } = render(<Navigation projects={mockProjects} />);

    // Dashboard link should NOT have active class
    const links = container.querySelectorAll("a");
    const dashboardLink = Array.from(links).find(
      (link) => link.getAttribute("href") === "/"
    );

    expect(dashboardLink?.className).toContain("text-sidebar-foreground/60");
    expect(dashboardLink?.className).toContain("hover:bg-sidebar-accent");
  });

  it("should highlight active project", () => {
    vi.mocked(usePathname).mockReturnValue("/projects/p1");

    const { container } = render(<Navigation projects={mockProjects} />);

    const links = container.querySelectorAll("a");
    const projectLink = Array.from(links).find(
      (link) => link.getAttribute("href") === "/projects/p1"
    );

    expect(projectLink?.className).toContain("bg-sidebar-accent");
    expect(projectLink?.className).toContain("font-medium");
  });

  it("should not highlight inactive projects", () => {
    vi.mocked(usePathname).mockReturnValue("/");

    const { container } = render(<Navigation projects={mockProjects} />);

    const links = container.querySelectorAll("a");
    const projectLink = Array.from(links).find(
      (link) => link.getAttribute("href") === "/projects/p1"
    );

    expect(projectLink?.className).toContain("text-sidebar-foreground/60");
    expect(projectLink?.className).not.toContain("font-medium");
  });

  it("should handle dashboard active state correctly", () => {
    vi.mocked(usePathname).mockReturnValue("/");

    const { container } = render(<Navigation projects={mockProjects} />);

    const links = container.querySelectorAll("a");
    const dashboardLink = Array.from(links).find(
      (link) => link.getAttribute("href") === "/"
    );

    expect(dashboardLink?.className).toContain("bg-sidebar-accent");
    expect(dashboardLink?.className).toContain("font-medium");
  });

  it("should not highlight dashboard for other routes", () => {
    vi.mocked(usePathname).mockReturnValue("/projects/p1");

    const { container } = render(<Navigation projects={mockProjects} />);

    const links = container.querySelectorAll("a");
    const dashboardLink = Array.from(links).find(
      (link) => link.getAttribute("href") === "/"
    );

    // Dashboard should not be highlighted - should NOT have bg-sidebar-accent
    // and should NOT have font-medium (which indicates active state)
    expect(dashboardLink?.className).toContain("text-sidebar-foreground/60");
    expect(dashboardLink?.className).toContain("hover:bg-sidebar-accent");
    expect(dashboardLink?.className).not.toContain("font-medium");
  });

  it("should truncate long project names", () => {
    const longNameProjects = [
      { id: "p1", name: "This is a very long project name that should be truncated" },
    ];

    render(<Navigation projects={longNameProjects} />);

    const projectElement = screen.getByText((content) =>
      content.startsWith("This is a very long")
    );
    expect(projectElement).toBeInTheDocument();
    // Check that truncate class is applied
    expect(projectElement).toHaveClass("truncate");
  });
});
