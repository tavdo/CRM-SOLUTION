import { requireWorkspace } from "@/lib/auth/workspace";
import { inboxScope } from "@/lib/inbox/access";
import { inboxError } from "@/lib/inbox/http";
import { inboxChangeVersion } from "@/lib/inbox/changes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const initial = await requireWorkspace(); inboxScope(initial);
    const encoder = new TextEncoder(); let stopped = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const stream = new ReadableStream({
      start(controller) {
        let last = ""; let ticks = 0;
        const close = () => { if (!stopped) { stopped = true; clearTimeout(timer); controller.close(); } };
        request.signal.addEventListener("abort", close, { once: true });
        const poll = async () => {
          if (stopped) return;
          try {
            const signature = await inboxChangeVersion(initial, ticks > 0);
            if (stopped) return;
            if (signature !== last || !ticks) { controller.enqueue(encoder.encode(`data: {"changed":true}\n\n`)); last = signature; }
            else controller.enqueue(encoder.encode(": heartbeat\n\n"));
            if (++ticks >= 25) { close(); return; }
            timer = setTimeout(poll, 2000);
          } catch { close(); }
        };
        void poll();
      },
      cancel() { stopped = true; clearTimeout(timer); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  } catch (error) { return inboxError(error); }
}
