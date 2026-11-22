import { SSE_EVENT, sseDoneDataSchema, sseErrorDataSchema, sseTextDataSchema, type SseEvent } from "@ether/shared";
import { ApiError, networkError } from "../errors";

const malformed = (why: string): ApiError =>
  new ApiError("internal", `Malformed AI stream (${why})`, { status: 502 });

/** Parses one `event:`/`data:` block. Comments and unknown events yield null. Throws on bad payloads. */
export function parseSseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;

  let json: unknown;
  try {
    json = JSON.parse(data.join("\n"));
  } catch {
    throw malformed("data is not JSON");
  }

  switch (event) {
    case SSE_EVENT.text: {
      const r = sseTextDataSchema.safeParse(json);
      if (!r.success) throw malformed("bad text event");
      return { event: "text", data: r.data };
    }
    case SSE_EVENT.done: {
      const r = sseDoneDataSchema.safeParse(json);
      if (!r.success) throw malformed("bad done event");
      return { event: "done", data: r.data };
    }
    case SSE_EVENT.error: {
      const r = sseErrorDataSchema.safeParse(json);
      if (!r.success) throw malformed("bad error event");
      return { event: "error", data: r.data };
    }
    default:
      return null;
  }
}

/**
 * Yields validated events and stops after the first terminal one. A stream that ends without
 * `done`/`error` is a dropped connection and rejects. Aborting the fetch rejects with AbortError.
 */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingCR = false;
  let finished = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      let chunk = pendingCR ? "\r" : "";
      pendingCR = false;
      if (value) chunk += decoder.decode(value, { stream: !done });
      if (done) chunk += decoder.decode();
      // A lone trailing CR may be the first half of CRLF; hold it back until the next chunk.
      if (!done && chunk.endsWith("\r")) {
        pendingCR = true;
        chunk = chunk.slice(0, -1);
      }
      buffer += chunk.replace(/\r\n?/g, "\n");

      for (let sep = buffer.indexOf("\n\n"); sep !== -1; sep = buffer.indexOf("\n\n")) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseSseBlock(block);
        if (!event) continue;
        yield event;
        if (event.event !== "text") {
          finished = true;
          return;
        }
      }

      if (done) {
        const event = buffer.trim() === "" ? null : parseSseBlock(buffer);
        if (event) {
          yield event;
          if (event.event !== "text") {
            finished = true;
            return;
          }
        }
        throw networkError(undefined, "The AI response ended unexpectedly. Please try again.");
      }
    }
  } finally {
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
