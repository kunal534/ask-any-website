import { redis } from '@/lib/redis';
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function POST() {
  try {
    const urls = await redis.smembers('indexed-urls');
    
    console.log(`Clearing ${urls?.length || 0} URLs...`);
    
    if (urls && urls.length > 0) {
      for (const url of urls) {
        const pageUrls = await redis.smembers(`pages:${url}`);
        if (pageUrls) {
          for (const pageUrl of pageUrls) {
            await redis.del(`page:${pageUrl}`);
          }
        }
        await redis.del(`pages:${url}`);
        await redis.del(`crawl-status:${url}`);
      }
    }
    
    await redis.del('indexed-urls');
    
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) {
      return Response.json({ error: 'PINECONE_INDEX_NAME is not configured' }, { status: 500 });
    }
    const index = pinecone.index(indexName);
    const stats = await index.describeIndexStats();
    
    if (stats.namespaces) {
      for (const namespace of Object.keys(stats.namespaces)) {
        await index.namespace(namespace).deleteAll();
        console.log(`✓ Cleared Pinecone namespace: ${namespace}`);
      }
    }
    
    return Response.json({ 
      success: true,
      message: 'All data cleared successfully',
      urlsCleared: urls?.length || 0,
    });
  } catch (error) {
    console.error('Clear all error:', error);
    return Response.json({ error: 'Failed to clear data' }, { status: 500 });
  }
}
