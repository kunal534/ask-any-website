import { NextRequest, NextResponse } from 'next/server';
import { startBackgroundCrawl } from '@/lib/background-crawler';

interface CrawlRequestBody {
  url: string;
  sessionId: string;
  options?: {
    maxPages?: number;
    maxDepth?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CrawlRequestBody;
    const { url, sessionId, options } = body;

    if (!url || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields: url and sessionId' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // background crawl (don't await - fire and forget)
    startBackgroundCrawl({ url, sessionId, options }).catch((error) => {
      console.error('❌ Background crawl error:', error);
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Background crawl started',
      sessionId,
    });
    
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: 'Failed to start background crawl' },
      { status: 500 }
    );
  }
}
