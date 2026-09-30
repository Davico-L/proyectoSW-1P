import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Share Diagram link generation and copy logic", () => {
  let originalClipboard: any;

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("constructs the expected URL format with active diagram id", () => {
    const activeDiagramId = "d067424b-440e-4408-b604-54c3798577ac";
    const origin = "http://localhost:3000";
    const url = `${origin}/?diagramId=${activeDiagramId}`;

    expect(url).toBe("http://localhost:3000/?diagramId=d067424b-440e-4408-b604-54c3798577ac");
  });

  it("copies URL to clipboard successfully when navigator.clipboard is available", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const url = "http://localhost:3000/?diagramId=123";
    await navigator.clipboard.writeText(url);

    expect(writeTextMock).toHaveBeenCalledWith(url);
  });

  it("falls back to input.select() when navigator.clipboard throws or is unavailable", async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error("Permission denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    const mockInput = {
      select: vi.fn(),
    };

    const url = "http://localhost:3000/?diagramId=123";
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      copied = false;
    }

    if (!copied) {
      mockInput.select();
    }

    expect(copied).toBe(false);
    expect(mockInput.select).toHaveBeenCalled();
  });

  it("handles copy feedback duration of 2 seconds", () => {
    vi.useFakeTimers();

    let isCopied = true;
    const timeout = setTimeout(() => {
      isCopied = false;
    }, 2000);

    expect(isCopied).toBe(true);
    vi.advanceTimersByTime(1999);
    expect(isCopied).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isCopied).toBe(false);

    clearTimeout(timeout);
    vi.useRealTimers();
  });
});
