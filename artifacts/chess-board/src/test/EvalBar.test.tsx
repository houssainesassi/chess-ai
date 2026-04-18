import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EvalBar } from "../components/EvalBar";

describe("EvalBar", () => {
  it("renders without crashing", () => {
    render(
      <EvalBar evaluationScore={0} isMate={false} evaluation="+0.0" turn="w" />
    );
    expect(screen.getByTestId("eval-bar")).toBeInTheDocument();
  });

  it("shows mate label when isMate is true", () => {
    render(
      <EvalBar evaluationScore={10} isMate={true} mateIn={3} evaluation="M3" turn="w" />
    );
    expect(screen.getByText("White wins")).toBeInTheDocument();
  });
});
