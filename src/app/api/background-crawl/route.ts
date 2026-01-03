import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundCrawl } from '@/lib/background-crawler';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, sessionId, options } = body;

    if (!url || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Start background crawl (don't await)
    startBackgroundCrawl({ url, sessionId, options }).catch(err => {
      console.error('Background crawl error:', err);
    });

    return NextResponse.json({ success: true, message: 'Background crawl started' });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to start background crawl' },
      { status: 500 }
    );
  }
}
