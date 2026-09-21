import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AnalysisResponseDto,
  SchemaInputDto,
} from "../api/schemawise-contracts";
import type { SchemaWiseApi } from "../api/schemawise-api";
import { SchemaWorkspace } from "../features/workspace/components/SchemaWorkspace";
import { DELAYED_ASYNC_HINT_MS, DelayedAsyncHint } from "./DelayedAsyncHint";

const HINT =
  "The public demo server may be waking up. Free-tier cold starts can take a little longer.";

function analysisFor(input: SchemaInputDto): AnalysisResponseDto {
  const [a, b, c] = input.relation.attributes.map(({ id }) => id) as [
    string,
    string,
    string,
  ];
  return {
    relation: input.relation,
    candidateKeys: [[a]],
    primeAttributes: [a],
    minimalCover: [
      { left: [a], right: [b] },
      { left: [b], right: [c] },
    ],
    normalForms: {
      second: { satisfied: true, violations: [] },
      third: {
        satisfied: false,
        violations: [{ determinant: [b], dependent: c }],
      },
      bcnf: {
        satisfied: false,
        violations: [{ determinant: [b], dependent: c }],
      },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("delayed async hint", () => {
  it("stays hidden during normal latency and announces once after the threshold", () => {
    render(<DelayedAsyncHint active requestKey="request-1" />);
    act(() => vi.advanceTimersByTime(DELAYED_ASYNC_HINT_MS - 1));
    expect(screen.queryByText(HINT)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getAllByText(HINT)).toHaveLength(1);
    expect(screen.getByText(HINT).getAttribute("aria-live")).toBe("polite");
  });

  it("disappears when either a successful or failed operation stops loading", () => {
    const view = render(<DelayedAsyncHint active requestKey="success" />);
    act(() => vi.advanceTimersByTime(DELAYED_ASYNC_HINT_MS));
    view.rerender(<DelayedAsyncHint active={false} requestKey="success" />);
    expect(screen.queryByText(HINT)).toBeNull();

    view.rerender(<DelayedAsyncHint active requestKey="error" />);
    act(() => vi.advanceTimersByTime(DELAYED_ASYNC_HINT_MS));
    view.rerender(<DelayedAsyncHint active={false} requestKey="error" />);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it("restarts the timer when a retry replaces an in-flight request", () => {
    const view = render(<DelayedAsyncHint active requestKey="request-1" />);
    act(() => vi.advanceTimersByTime(DELAYED_ASYNC_HINT_MS - 1));
    view.rerender(<DelayedAsyncHint active requestKey="request-2" />);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText(HINT)).toBeNull();
    act(() => vi.advanceTimersByTime(DELAYED_ASYNC_HINT_MS - 1));
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it("clears its pending timer when unmounted", () => {
    const clearTimeout = vi.spyOn(window, "clearTimeout");
    const view = render(<DelayedAsyncHint active requestKey="request-1" />);
    view.unmount();
    expect(clearTimeout).toHaveBeenCalledTimes(1);
  });

  it("adds no request, then clears the hint after analysis success and error", async () => {
    const first = deferred<AnalysisResponseDto>();
    const second = deferred<AnalysisResponseDto>();
    const analyzeSchema = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const api: SchemaWiseApi = {
      analyzeSchema,
      calculateClosure: vi.fn(),
      synthesizeThirdNormalForm: vi.fn(),
      decomposeBoyceCodd: vi.fn(),
      analyzeDependencyPreservation: vi.fn(),
    };

    render(<SchemaWorkspace api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "Load example" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze schema" }));
    act(() => vi.advanceTimersByTime(DELAYED_ASYNC_HINT_MS));
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(analyzeSchema).toHaveBeenCalledTimes(1);

    const firstInput = analyzeSchema.mock.calls[0]![0] as SchemaInputDto;
    await act(async () => first.resolve(analysisFor(firstInput)));
    expect(screen.queryByText(HINT)).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Edit schema" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze again" }));
    act(() => vi.advanceTimersByTime(DELAYED_ASYNC_HINT_MS));
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(analyzeSchema).toHaveBeenCalledTimes(2);
    await act(async () => second.reject(new Error("failed")));
    expect(screen.queryByText(HINT)).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Analysis failed");
  });
});
