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
    let rateLimitHits = 0;
    // Small parallelism only — each page fans out into several Mistral
    // embedding calls, so 2 pages at a time is already ~4 concurrent
    // Mistral requests. Larger batches guarantee 429s on free tier.
    const batchSize = 2;
    const BATCH_PAUSE_MS = 2000;
    
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

      let batchRateLimited = false;
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          console.log(`✓ [${successCount}/${newPages.length}] ${result.value.title}`);
        } else if (result.status === 'fulfilled' && !result.value.success) {
          const msg = String(
            (result.value.error as Error)?.message || result.value.error || ''
          );
          if (msg.includes('429') || msg.includes('rate limit')) {
            batchRateLimited = true;
          }
        }
      });

      if (batchRateLimited) {
        rateLimitHits++;
        // Back off progressively; abort if Mistral keeps refusing so chat
        // quota can recover instead of burning it in a tight loop.
        const backoff = Math.min(5000 * rateLimitHits, 30000);
        console.warn(
          `⏳ Mistral 429 during crawl (${rateLimitHits}x). Pausing ${backoff}ms...`
        );
        await new Promise((r) => setTimeout(r, backoff));
        if (rateLimitHits >= 3) {
          throw new Error(
            'Mistral rate limit hit repeatedly (429) — pausing background crawl. Already-indexed pages still work; retry crawl later or upgrade Mistral tier.'
          );
        }
      } else {
        rateLimitHits = 0;
      }

      await redis.hset(`crawl-status:${url}`, {
        status: 'crawling',
        sessionId,
        newPagesIndexed: successCount.toString(),
        totalPages: newPages.length.toString(),
      });

      // Space out Mistral embedding bursts between page batches.
      if (i + batchSize < newPages.length) {
        await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
      }
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
