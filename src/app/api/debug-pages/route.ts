import { redis } from '@/lib/redis';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return Response.json({ error: 'URL required' }, { status: 400 });
  }

  try {
    const pages = await redis.smembers(`pages:${url}`);
    
    const pageDetails = await Promise.all(
      pages.map(async (pageUrl) => {
        const data = await redis.hgetall(`page:${pageUrl}`);
        
        return {
          url: pageUrl,
          title: (data?.title as string) || 'Unknown',
          pageType: (data?.pageType as string) || 'Unknown',
          contentLength: ((data?.content as string) || '').length,
        };
      })
    );

    return Response.json({
      totalPages: pages.length,
      pages: pageDetails,
    });
  } catch (error) {
    console.error('Debug error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
