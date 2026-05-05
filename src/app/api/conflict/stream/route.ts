import { cacheGet } from '../../../../lib/property-intelligence/cache';
import { CONFLICT_UPDATES_KEY } from '../../../../lib/conflict/constants';
import type { ConflictUpdateEvent } from '../../../../lib/conflict/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const POLL_INTERVAL_MS = 3000;
const MAX_DURATION_MS = 5 * 60 * 1000; // 5min then close so clients reconnect

/**
 * Server-Sent Events bridge in lieu of WebSocket.
 * Polls a Redis key updated by the scorer; pushes a frame whenever the
 * timestamp changes. Closes itself after 5min to keep serverless lifetimes tame.
 */
export async function GET() {
  /** Shared with `cancel()` so polling stops when the client disconnects (avoids enqueue after close). */
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const stop = () => {
    stopped = true;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: ConflictUpdateEvent | { event: 'heartbeat'; timestamp: string }) => {
        if (stopped) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Client disconnected — controller already closed; stop polling.
          stop();
        }
      };

      send({ event: 'heartbeat', timestamp: new Date().toISOString() });

      let lastSeenTs: string | null = null;
      const startedAt = Date.now();

      intervalId = setInterval(async () => {
        if (stopped) return;
        if (Date.now() - startedAt > MAX_DURATION_MS) {
          stop();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          return;
        }
        try {
          const update = await cacheGet<ConflictUpdateEvent>(CONFLICT_UPDATES_KEY);
          if (stopped) return;
          if (update?.timestamp && update.timestamp !== lastSeenTs) {
            lastSeenTs = update.timestamp;
            send(update);
          } else {
            send({ event: 'heartbeat', timestamp: new Date().toISOString() });
          }
        } catch (e) {
          if (!stopped) console.warn('[stream] poll failed', String(e));
        }
      }, POLL_INTERVAL_MS);
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
