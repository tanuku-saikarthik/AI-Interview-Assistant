import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "../../src/App";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock only the fetch API (not axios)
global.fetch = vi.fn();

describe("API Call Trigger Test", () => {

  beforeEach(() => {
    fetch.mockReset();
  });

  it("calls API when button is clicked", async () => {
    fetch.mockResolvedValue({
      json: async () => ({ reply: "ok" })
    });

    render(<App />);

    const btn = screen.getByRole("button");

    fireEvent.click(btn);

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
