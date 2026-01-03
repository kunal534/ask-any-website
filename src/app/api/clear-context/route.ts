import { redis } from '@/lib/redis';
import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function POST() {
  try {
    // Get all indexed URLs
    const urls = await redis.smembers('indexed-urls');
    
    console.log(`Clearing ${urls?.length || 0} URLs...`);
    
    if (urls && urls.length > 0) {
      for (const url of urls) {
        // Clear Redis
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
    
    // Clear indexed URLs set
    await redis.del('indexed-urls');
    
    // Clear all Pinecone namespaces
    const index = pinecone.index('chatbot');
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
