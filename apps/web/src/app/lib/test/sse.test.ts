import { describe, expect, it } from "vitest";
import { parseSseBlock, parseSseStream } from "../client/sse";
import { ApiError } from "../errors";

const enc = new TextEncoder();

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}

async function collect(body: ReadableStream<Uint8Array>) {
  const out = [];
  for await (const e of parseSseStream(body)) out.push(e);
  return out;
}

describe("parseSseBlock", () => {
  it("parses text, done and error events", () => {
    expect(parseSseBlock('event: text\ndata: {"text":"hi"}')).toEqual({ event: "text", data: { text: "hi" } });
    expect(parseSseBlock('event: done\ndata: {"route":"default"}')).toEqual({ event: "done", data: { route: "default" } });
    expect(parseSseBlock('event: error\ndata: {"error":{"code":"internal","message":"x"}}')).toEqual({
      event: "error",
      data: { error: { code: "internal", message: "x" } },
    });
  });

  it("ignores comments, unknown events and blocks with no data", () => {
    expect(parseSseBlock(": keep-alive")).toBeNull();
    expect(parseSseBlock('event: ping\ndata: {"a":1}')).toBeNull();
    expect(parseSseBlock("event: text")).toBeNull();
  });

  it("throws on non-JSON or schema-invalid payloads", () => {
    expect(() => parseSseBlock("event: text\ndata: nope")).toThrow(ApiError);
    expect(() => parseSseBlock('event: text\ndata: {"text":5}')).toThrow(ApiError);
  });
});

describe("parseSseStream", () => {
  it("reassembles events split across chunks and stops after done", async () => {
    const body = streamOf(
      'event: text\ndata: {"te',
      'xt":"a"}\n\nevent: text\ndata: {"text":"b"}\n\n',
      'event: done\ndata: {}\n\nevent: text\ndata: {"text":"ignored"}\n\n',
    );
    const events = await collect(body);
    expect(events.map((e) => e.event)).toEqual(["text", "text", "done"]);
  });

  it("handles CRLF, including a CR split from its LF", async () => {
    const body = streamOf('event: text\r\ndata: {"text":"a"}\r', '\n\r\nevent: done\r\ndata: {}\r\n\r\n');
    const events = await collect(body);
    expect(events.map((e) => e.event)).toEqual(["text", "done"]);
  });

  it("rejects as a network error when the stream ends without a terminal event", async () => {
    const body = streamOf('event: text\ndata: {"text":"a"}\n\n');
    await expect(collect(body)).rejects.toMatchObject({ isNetwork: true });
  });

  it("stops at a terminal error event", async () => {
    const body = streamOf('event: error\ndata: {"error":{"code":"ai_limit_reached","message":"m","resetAt":10}}\n\n');
    const events = await collect(body);
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("error");
  });
});
