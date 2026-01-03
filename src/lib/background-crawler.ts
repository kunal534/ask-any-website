import { deepCrawl } from './crawler';
import { redis } from './redis';
import { storePageContent } from './context-retrieval';
import { storeInPinecone } from './pinecone-client';

// NO getRagChatForUrl import!

interface BackgroundCrawlJob {
  url: string;
  sessionId: string;
  options: {
    maxDepth?: number;
    maxPages?: number;
    useJavaScript?: boolean;
  };
}

export async function startBackgroundCrawl(job: BackgroundCrawlJob) {
  const { url, sessionId, options } = job;
  
  try {
    console.log(`🔄 Background crawl started for: ${url}`);
    
    await redis.hset(`crawl-status:${url}`, {
      status: 'crawling',
      startedAt: new Date().toISOString(),
    });

    const crawlResults = await deepCrawl(url, {
      maxDepth: options.maxDepth || 2,
      maxPages: options.maxPages || 30,
      delayMs: options.useJavaScript ? 1000 : 500,
      timeout: options.useJavaScript ? 15000 : 5000,
      sameDomainOnly: true,
      useJavaScript: options.useJavaScript || false,
    });

    const newPages = crawlResults.filter(result => result.url !== url);

    console.log(`📄 Indexing ${newPages.length} pages in Pinecone...`);

    let successCount = 0;

    for (const result of newPages) {
      try {
        await storePageContent({
          url: result.url,
          title: result.title,
          content: result.content,
          sourceUrl: url,
          timestamp: new Date().toISOString(),
        });

        await storeInPinecone(url, result.url, result.title, result.content);
        
        successCount++;
        console.log(`✓ [${successCount}/${newPages.length}] ${result.title}`);
      } catch (err) {
        console.error(`✗ Failed: ${result.url}`, err);
      }
    }

    await redis.hset(`crawl-status:${url}`, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      totalPages: (crawlResults.length).toString(),
      newPagesIndexed: successCount.toString(),
    });

    console.log(`✅ Crawl completed: ${successCount} pages indexed`);

  } catch (error) {
    console.error('Background crawl failed:', error);
    await redis.hset(`crawl-status:${url}`, {
      status: 'failed',
      error: (error as Error).message,
    });
  }
}
