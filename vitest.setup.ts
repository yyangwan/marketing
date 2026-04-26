import { vi, beforeEach, afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { configure } from '@testing-library/dom';

// Configure @testing-library/dom
configure({
  // computedStyleSupportsCssColorScheme is not available, removed
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

// Mock window.confirm globally
global.confirm = vi.fn(() => true) as unknown as () => boolean;

// Ensure window and document are available for happy-dom
if (typeof window === 'undefined') {
  global.window = global.window as any;
}
if (typeof document === 'undefined') {
  global.document = global.document as any;
}

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock NextAuth
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    workspace: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    project: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contentPiece: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    brandVoice: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    template: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

// Mock AI client
vi.mock('@/lib/ai/client', () => ({
  callLLM: vi.fn(),
}));

// Extend Vitest's expect with DOM matchers
import '@testing-library/jest-dom/vitest';
