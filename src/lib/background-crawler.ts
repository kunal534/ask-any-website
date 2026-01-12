import { deepCrawl } from './crawler';
import { redis } from './redis';
import { storePageContent } from './context-retrieval';
import { storeInPinecone } from './pinecone-client';

interface BackgroundCrawlJob {
  url: string;
  sessionId: string;
  options?: {
    maxDepth?: number;
    maxPages?: number;
    useJavaScript?: boolean;
  };
}

interface CrawlStatus {
  status: 'crawling' | 'completed' | 'failed';
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  totalPages: number;
  newPagesIndexed: number;
  error?: string;
  failedAt?: string;
}

export async function startBackgroundCrawl(job: BackgroundCrawlJob) {
  const { url, sessionId, options = {} } = job;
  
  try {
    console.log(`🔄 Background crawl started for: ${url} (Session: ${sessionId})`);
    
    await redis.hset(`crawl-status:${url}`, {
      status: 'crawling',
      sessionId,
      startedAt: new Date().toISOString(),
      newPagesIndexed: '0',
      totalPages: '0',
    });

    const crawlResults = await deepCrawl(url, {
      maxDepth: options.maxDepth ?? 3,
      maxPages: options.maxPages ?? 100,
      delayMs: options.useJavaScript ? 1000 : 500,
      timeout: options.useJavaScript ? 15000 : 5000,
      sameDomainOnly: true,
      useJavaScript: options.useJavaScript ?? false,
    });

    const newPages = crawlResults.filter(result => result.url !== url);
    console.log(`📄 Indexing ${newPages.length} pages in Pinecone...`);

    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < newPages.length; i += batchSize) {
      const batch = newPages.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(async (result, idx) => {
          try {
            const finalTitle = result.title || `Page ${i + idx + 1}`;

            await storePageContent({
              url: result.url,
              title: finalTitle,
              content: result.content,
              sourceUrl: url,
              timestamp: new Date().toISOString(),
            });

            await storeInPinecone(url, result.url, finalTitle, result.content);
            return { success: true, title: finalTitle };
          } catch (error) {
            console.error(`✗ Failed: ${result.url}`, error);
            return { success: false, error };
          }
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          console.log(`✓ [${successCount}/${newPages.length}] ${result.value.title}`);
        }
      });

      await redis.hset(`crawl-status:${url}`, {
        status: 'crawling',
        sessionId,
        newPagesIndexed: successCount.toString(),
        totalPages: newPages.length.toString(),
      });
    }

    console.log('🎯 Loop completed, marking as done...');

    await redis.hset(`crawl-status:${url}`, {
      status: 'completed',
      sessionId,
      completedAt: new Date().toISOString(),
      totalPages: crawlResults.length.toString(),
      newPagesIndexed: successCount.toString(),
    });

    console.log(`✅ Crawl completed: ${successCount}/${newPages.length} pages indexed`);
    console.log(`✅ Status set to 'completed' in Redis`);

  } catch (error) {
    console.error('❌ Background crawl failed:', error);
    
    await redis.hset(`crawl-status:${url}`, {
      status: 'failed',
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
      failedAt: new Date().toISOString(),
    });
  }
}

export async function getCrawlStatus(url: string): Promise<CrawlStatus | null> {
  try {
    const data = await redis.hgetall(`crawl-status:${url}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    const statusData = data as Record<string, string>;
    
    return {
      status: (statusData.status || 'crawling') as CrawlStatus['status'],
      sessionId: statusData.sessionId || '',
      startedAt: statusData.startedAt || new Date().toISOString(),
      completedAt: statusData.completedAt,
      totalPages: parseInt(statusData.totalPages || '0', 10),
      newPagesIndexed: parseInt(statusData.newPagesIndexed || '0', 10),
      error: statusData.error,
      failedAt: statusData.failedAt,
    };
  } catch (error) {
    console.error('❌ Failed to get crawl status:', error);
    return null;
  }
}
