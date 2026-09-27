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
        const raw = await redis.get(`page:${pageUrl}`);

        let title = 'Unknown';
        let contentLength = 0;
        if (raw) {
          try {
            const parsed =
              typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>);
            title = (parsed.title as string) || 'Unknown';
            contentLength = ((parsed.content as string) || '').length;
          } catch {
            // legacy hash shape fallback (pre-JSON-string storage)
            const legacy = (await redis.hgetall(
              `page:${pageUrl}`
            )) as Record<string, string> | null;
            title = legacy?.title || 'Unknown';
            contentLength = (legacy?.content || '').length;
          }
        }

        return {
          url: pageUrl,
          title,
          contentLength,
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
