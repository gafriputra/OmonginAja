import assert from "node:assert/strict";
import { test } from "node:test";
import { LatencyMeter } from "./latency.js";

const loud = new Int16Array(1600).fill(8000);
const quiet = new Int16Array(1600);

test("measures from speech onset after a pause to the first translated audio", () => {
  const meter = new LatencyMeter();
  meter.onInput(quiet, 0);
  meter.onInput(loud, 1000);
  meter.onInput(loud, 1100);
  assert.equal(meter.onOutput(2200), 1200);
  assert.equal(meter.onOutput(2300), undefined, "later chunks of the same utterance are not measured");

  meter.onInput(loud, 1500); // still talking, no pause: not a new onset
  assert.equal(meter.onOutput(2500), undefined);

  meter.onInput(loud, 4000); // after a pause
  assert.equal(meter.onOutput(4800), 800);
  assert.equal(meter.average, 1000);
});
