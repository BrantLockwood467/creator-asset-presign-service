export function processingState(uploaded: boolean, scanPassed: boolean): "awaiting_upload" | "processing" | "ready" {
  if (!uploaded) return "awaiting_upload";
  return scanPassed ? "ready" : "processing";
}
