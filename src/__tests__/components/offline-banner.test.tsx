import { render, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OfflineBanner } from "@/components/offline-banner";

describe("OfflineBanner", () => {
  const fireOnline = () => window.dispatchEvent(new Event("online"));
  const fireOffline = () => window.dispatchEvent(new Event("offline"));

  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when online", () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows banner when offline event fires", () => {
    render(<OfflineBanner />);
    act(() => fireOffline());
    expect(screen.getByText(/you're offline/i)).toBeTruthy();
  });

  it("hides banner when back online", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true, writable: true });
    render(<OfflineBanner />);
    act(() => fireOffline());
    expect(screen.getByText(/you're offline/i)).toBeTruthy();
    act(() => fireOnline());
    expect(screen.queryByText(/you're offline/i)).toBeNull();
  });
});
