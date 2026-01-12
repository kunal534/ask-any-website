import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter required' },
      { status: 400 }
    );
  }

  try {
    const data = await redis.hgetall(`crawl-status:${url}`);
    
    console.log('📊 Redis status for', url, ':', data);
    
    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No crawl found for this URL' },
        { status: 404 }
      );
    }

    const statusData = data as Record<string, string>;
    
    const response = {
      status: statusData.status || 'crawling',
      sessionId: statusData.sessionId || '',
      startedAt: statusData.startedAt || new Date().toISOString(),
      completedAt: statusData.completedAt,
      totalPages: parseInt(statusData.totalPages || '0', 10),
      newPagesIndexed: parseInt(statusData.newPagesIndexed || '0', 10),
      error: statusData.error,
      failedAt: statusData.failedAt,
    };

    console.log('✅ Returning status:', response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Status check failed:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
