import type { ErrorDescription } from "../../lib/errors";

export type GenerationState =
  | { readonly status: "idle" }
  | { readonly status: "streaming"; readonly text: string }
  | { readonly status: "error"; readonly error: ErrorDescription };

export type GenerationAction =
  | { readonly type: "start" }
  | { readonly type: "chunk"; readonly text: string }
  | { readonly type: "fail"; readonly error: ErrorDescription }
  | { readonly type: "reset" };

export const initialGeneration: GenerationState = { status: "idle" };

export function generationReducer(state: GenerationState, action: GenerationAction): GenerationState {
  switch (action.type) {
    case "start":
      return { status: "streaming", text: "" };
    case "chunk":
      return state.status === "streaming" ? { status: "streaming", text: state.text + action.text } : state;
    case "fail":
      // Partial output is discarded on failure: a half-written block never reaches the shared document.
      return { status: "error", error: action.error };
    case "reset":
      return initialGeneration;
  }
}
