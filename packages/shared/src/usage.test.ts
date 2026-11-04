import assert from "node:assert/strict";
import { test } from "node:test";
import { UsageTracker } from "./usage.js";

test("adds up streamed seconds per provider per day and month", () => {
  const usage = new UsageTracker();
  usage.record("gemini", 90, new Date(2026, 10, 4, 9));
  usage.record("gemini", 30, new Date(2026, 10, 4, 17));
  usage.record("openai", 60, new Date(2026, 10, 4, 10));
  usage.record("gemini", 600, new Date(2026, 10, 1, 8));
  usage.record("gemini", 999, new Date(2026, 9, 31, 8));

  assert.equal(usage.secondsOn("gemini", new Date(2026, 10, 4)), 120);
  assert.equal(usage.secondsOn("openai", new Date(2026, 10, 4)), 60);
  assert.equal(usage.secondsInMonth("gemini", new Date(2026, 10, 20)), 720);

  const restored = new UsageTracker(JSON.parse(JSON.stringify(usage)));
  assert.equal(restored.secondsOn("gemini", new Date(2026, 10, 4)), 120);
});
