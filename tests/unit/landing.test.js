import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LandingPage from "../../src/components/LandingPage";

describe("Landing Page", () => {
  it("renders the landing page text", () => {
    render(<LandingPage />);
    expect(screen.getByText(/interview assistant/i)).toBeTruthy();
  });
});
