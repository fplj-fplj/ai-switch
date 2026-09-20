import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationEntry } from "../src/ApplicationEntry";

vi.mock("../src/App", () => ({ App: () => <div>administrator</div> }));

afterEach(cleanup);

it("renders the administrator app", () => {
  render(<ApplicationEntry />);
  expect(screen.getByText("administrator")).toBeInTheDocument();
});
