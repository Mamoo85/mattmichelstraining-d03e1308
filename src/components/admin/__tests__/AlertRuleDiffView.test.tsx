import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AlertRuleDiffView from "../AlertRuleDiffView";

describe("AlertRuleDiffView", () => {
  it("renders 'No differences.' when configs are identical", () => {
    render(<AlertRuleDiffView liveConfig={{ a: 1, nested: { x: "y" } }} testConfig={{ a: 1, nested: { x: "y" } }} />);
    expect(screen.getByText(/no differences/i)).toBeInTheDocument();
  });

  it("flags changed primitive fields", () => {
    render(<AlertRuleDiffView liveConfig={{ threshold: 2.0 }} testConfig={{ threshold: 3.5 }} />);
    expect(screen.getByText("threshold")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3.5")).toBeInTheDocument();
  });

  it("flags added and removed fields", () => {
    render(<AlertRuleDiffView liveConfig={{ a: 1 }} testConfig={{ b: 2 }} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("flattens nested objects with dot notation", () => {
    render(
      <AlertRuleDiffView
        liveConfig={{ rule: { quietStart: 21 } }}
        testConfig={{ rule: { quietStart: 22 } }}
      />,
    );
    expect(screen.getByText("rule.quietStart")).toBeInTheDocument();
  });

  it("handles null configs gracefully", () => {
    render(<AlertRuleDiffView liveConfig={null} testConfig={null} />);
    expect(screen.getByText(/no differences/i)).toBeInTheDocument();
  });
});
