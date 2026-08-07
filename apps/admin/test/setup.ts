import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import React from "react";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...props }, children) }));
afterEach(() => cleanup());
