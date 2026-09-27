import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { startBackgroundCrawl } from '@/lib/background-crawler';
import { isAllowedUrl, normalizeCrawlOptions } from '@/lib/url-guard';
import { sessionIdForUrl } from '@/lib/session';
import { checkRateLimit } from '@/lib/rate-limit';

interface CrawlRequestBody {
  url: string;
  sessionId: string;
  options?: {
    maxPages?: number;
    maxDepth?: number;
    useJavaScript?: boolean;
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

    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        { error: 'URL not allowed. Only public http(s) websites are supported.' },
        { status: 400 }
      );
    }

    if (sessionIdForUrl(url) !== sessionId) {
      return NextResponse.json(
        { error: 'sessionId does not match url' },
        { status: 400 }
      );
    }

    const { allowed } = await checkRateLimit(`crawl:${sessionId}`, 3, 300);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Crawl already requested. Please wait a few minutes.' },
        { status: 429 }
      );
    }

    const normalized = normalizeCrawlOptions(options);

    // Use `after()` so the crawl survives the response on serverless.
    after(() =>
      startBackgroundCrawl({ url, sessionId, options: normalized }).catch((error) => {
        console.error('❌ Background crawl error:', error);
      })
    );

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
