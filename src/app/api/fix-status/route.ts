import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL required' }, { status: 400 });
    }

    const currentData = await redis.hgetall(`crawl-status:${url}`) as Record<string, string>;
    
    if (!currentData || Object.keys(currentData).length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 });
    }

    // ✅ Fixed: Use object syntax instead of variadic args
    await redis.hset(`crawl-status:${url}`, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true,
      message: 'Status fixed to completed',
      data: await redis.hgetall(`crawl-status:${url}`)
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
