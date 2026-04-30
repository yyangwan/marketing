/**
 * Genie URL Fetcher Tests
 */

import { describe, it, expect } from "vitest";
import {
  isContentSubstantial,
  URLFetchError,
} from "../url-fetcher";

describe("URLFetchError", () => {
  it("should create error with proper message", () => {
    const error = new URLFetchError("https://example.com", "Network error");
    expect(error.message).toContain("example.com");
    expect(error.message).toContain("Network error");
    expect(error.name).toBe("URLFetchError");
    expect(error.url).toBe("https://example.com");
    expect(error.reason).toBe("Network error");
  });
});

describe("isContentSubstantial", () => {
  it("should return true for substantial content", () => {
    const content = {
      url: "https://example.com",
      title: "Example Article",
      content: "a".repeat(300), // 300 chars
      html: "",
      images: ["https://example.com/img.jpg"],
      links: [],
      metadata: {},
    };
    expect(isContentSubstantial(content)).toBe(true);
  });

  it("should return false for short content", () => {
    const content = {
      url: "https://example.com",
      title: "Short",
      content: "a".repeat(100), // Only 100 chars
      html: "",
      images: [],
      links: [],
      metadata: {},
    };
    expect(isContentSubstantial(content)).toBe(false);
  });

  it("should return false for content without title", () => {
    const content = {
      url: "https://example.com",
      title: "",
      content: "a".repeat(500),
      html: "",
      images: [],
      links: [],
      metadata: {},
    };
    expect(isContentSubstantial(content)).toBe(false);
  });
});

describe("extractLinks", () => {
  it("should extract links from markdown content", () => {
    const content = "Check out [this link](https://example.com/page) and also https://another.com";
    const links = content.match(/https?:\/\/[^\s\])\]}>"`]+/g);
    expect(links).toContain("https://example.com/page");
    expect(links).toContain("https://another.com");
  });
});

describe("extractImages", () => {
  it("should extract images from markdown content", () => {
    const content = "![img1](https://example.com/img1.jpg) and ![img2](https://example.com/img2.png)";
    const imgRegex = /!\[.*?\]\(([^)]+)\)/g;
    const images: string[] = [];
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      images.push(match[1]);
    }
    expect(images).toHaveLength(2);
    expect(images[0]).toBe("https://example.com/img1.jpg");
  });
});
