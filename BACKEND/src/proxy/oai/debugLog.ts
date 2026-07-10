// Developer observability for the OAI proxy — traces each step to the server
// console. Backend-only; the polled frontend panel was removed to keep things lean.
export type OaiDebugPhase =
  | "request"
  | "negotiate"
  | "fetch"
  | "parse"
  | "map"
  | "response"
  | "error";

export function oaiDebug(phase: OaiDebugPhase, message: string, data?: Record<string, any>): void {
  console.log(`\x1b[90m[oai:${phase}]\x1b[0m ${message}`, data ?? "");
}
