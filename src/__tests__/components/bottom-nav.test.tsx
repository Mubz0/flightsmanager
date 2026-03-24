import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { BottomNav } from "@/components/bottom-nav";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";

afterEach(cleanup);

describe("BottomNav", () => {
  it("marks Chat tab active on /", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<BottomNav pinnedCount={0} />);
    const chatTab = screen.getByRole("link", { name: /chat/i });
    expect(chatTab.className).toMatch(/text-blue/);
  });

  it("marks Pinned tab active on /pinned", () => {
    vi.mocked(usePathname).mockReturnValue("/pinned");
    render(<BottomNav pinnedCount={3} />);
    const pinnedTab = screen.getByRole("link", { name: /pinned/i });
    expect(pinnedTab.className).toMatch(/text-blue/);
  });

  it("shows pinned count badge when > 0", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<BottomNav pinnedCount={5} />);
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("hides badge when pinned count is 0", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    render(<BottomNav pinnedCount={0} />);
    expect(screen.queryByText("0")).toBeNull();
  });
});
