import { describe, expect, it, vi } from "vitest";
import { pushBackHandler, runTopBackHandler } from "../../src/lib/backHandler";

describe("backHandler", () => {
  it("runs the innermost handler and reports it was consumed", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const popOuter = pushBackHandler(outer);
    const popInner = pushBackHandler(inner);

    expect(runTopBackHandler()).toBe(true);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    popInner();
    expect(runTopBackHandler()).toBe(true);
    expect(outer).toHaveBeenCalledTimes(1);

    popOuter();
    expect(runTopBackHandler()).toBe(false);
  });

  it("falls back to the next handler when one unregisters out of order", () => {
    const first = vi.fn();
    const second = vi.fn();
    const popFirst = pushBackHandler(first);
    const popSecond = pushBackHandler(second);

    popSecond();
    expect(runTopBackHandler()).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    popFirst();
  });

  it("reports an empty stack as unconsumed", () => {
    expect(runTopBackHandler()).toBe(false);
  });
});