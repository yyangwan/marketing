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

// Route handlers call Next.js request APIs after service-auth was unified.
// Unit tests run without a Next.js request store, so default to browser-session
// behavior; route-specific tests can override these headers when needed.
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock NextAuth
vi.mock('@/lib/auth/config', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/db', () => {
  const prisma = {
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    workspace: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    project: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contentPiece: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contentBrief: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    contentWorkflow: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    contentGenerationRun: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), delete: vi.fn() },
    aITemplate: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    platformContent: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    brandVoice: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    template: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  // 事务 mock：以同一 prisma 对象作为 tx 执行。
  Object.assign(prisma, {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    $queryRaw: vi.fn(),
  });
  return { prisma };
});

// Mock AI client
vi.mock('@/lib/ai/client', () => ({
  callLLM: vi.fn(),
}));

// Extend Vitest's expect with DOM matchers
import '@testing-library/jest-dom/vitest';
