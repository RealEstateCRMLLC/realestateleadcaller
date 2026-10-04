import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';

export async function POST() {
  try {
    // We now decouple the chron logic. Instead of processing synchronously,
    // we fire an event into the background queue to be handled by Inngest.
    await inngest.send({
      name: 'workflow/tick',
      data: {}
    });

    return NextResponse.json({
        success: true,
        message: 'Engine tick successfully queued for background processing.'
    });
  } catch (error) {
    console.error(error);
    // When Inngest is unconfigured (no event key / local dev without Inngest server),
    // the send() call rejects. This is not a code bug — return 202 so callers know
    // the tick was accepted even though background processing is unavailable.
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('event key') || msg.includes('signing key') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return NextResponse.json({
        success: true,
        queued: false,
        message: 'Engine tick accepted. Inngest is not configured — background processing disabled. Set INNGEST_EVENT_KEY to enable.',
        error: msg,
      }, { status: 202 });
    }
    return NextResponse.json({ error: 'Failed to queue engine tick', detail: msg }, { status: 500 });
  }
}
