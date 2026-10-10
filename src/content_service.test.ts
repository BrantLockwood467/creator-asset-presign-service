import assert from "node:assert/strict";
import { processingState } from "./processing_state.ts";

assert.equal(processingState(false, false), "awaiting_upload");
assert.equal(processingState(true, false), "processing");
assert.equal(processingState(true, true), "ready");
console.log("processing state decisions pass");
