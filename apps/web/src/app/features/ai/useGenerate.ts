import { ERROR_STATUS, type AiGenerateInput } from "@ether/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useApi } from "../../lib/client/context";
import { describeError, fromApiError, isAbortError } from "../../lib/errors";
import { queryKeys } from "../../lib/queries";
import { generationReducer, initialGeneration, type GenerationState } from "./generation";

export interface UseGenerate {
  readonly state: GenerationState;
  /** Resolves with the full text on success, or null when the run failed or was cancelled. */
  run(input: AiGenerateInput): Promise<string | null>;
  dismissError(): void;
}

export function useGenerate(): UseGenerate {
  const api = useApi();
  const client = useQueryClient();
  const [state, dispatch] = useReducer(generationReducer, initialGeneration);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const run = useCallback(
    async (input: AiGenerateInput): Promise<string | null> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      dispatch({ type: "start" });

      let text = "";
      try {
        for await (const event of api.generate(input, controller.signal)) {
          if (event.event === "text") {
            text += event.data.text;
            dispatch({ type: "chunk", text: event.data.text });
          } else if (event.event === "error") {
            dispatch({ type: "fail", error: describeError(fromApiError(event.data, ERROR_STATUS[event.data.error.code])) });
            return null;
          } else {
            break;
          }
        }
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) return null;
        dispatch({ type: "fail", error: describeError(err) });
        return null;
      } finally {
        void client.invalidateQueries({ queryKey: queryKeys.aiUsage() });
      }

      dispatch({ type: "reset" });
      return text;
    },
    [api, client],
  );

  const dismissError = useCallback(() => dispatch({ type: "reset" }), []);
  return { state, run, dismissError };
}
