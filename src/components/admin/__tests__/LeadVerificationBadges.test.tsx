import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LeadVerificationBadges from "../LeadVerificationBadges";

describe("LeadVerificationBadges", () => {
  it("shows Grounded badge when verifier_grounded is true", () => {
    render(<LeadVerificationBadges verifier_grounded={true} />);
    expect(screen.getByText(/grounded/i)).toBeInTheDocument();
  });

  it("shows Unverified badge when verifier_grounded is false/null", () => {
    render(<LeadVerificationBadges verifier_grounded={false} />);
    expect(screen.getByText(/unverified/i)).toBeInTheDocument();
  });

  it("shows Citation match only when both grounded and citation match are true", () => {
    render(<LeadVerificationBadges verifier_grounded={true} verifier_citation_match={true} />);
    expect(screen.getByText(/citation match/i)).toBeInTheDocument();
  });

  it("shows Geo-locked when has_coordinates is true", () => {
    render(<LeadVerificationBadges verifier_grounded={true} has_coordinates={true} />);
    expect(screen.getByText(/geo-locked/i)).toBeInTheDocument();
  });

  it("renders verification_method label as a badge", () => {
    render(<LeadVerificationBadges verifier_grounded={true} verification_method="firecrawl_zillow" />);
    expect(screen.getByText("firecrawl_zillow")).toBeInTheDocument();
  });
});
