import { redis } from './redis';

interface PageData {
  url: string;
  title: string;
  content: string;
  sourceUrl: string;
  timestamp: string;
}

export async function storePageContent(page: PageData) {
  try {
    const pageKey = `page:${page.url}`;
    const sourceKey = `pages:${page.sourceUrl}`;
    
    // Store as JSON string
    await redis.set(pageKey, JSON.stringify(page));
    
    // Add to source set
    await redis.sadd(sourceKey, page.url);
    
    console.log(`✓ Stored in Redis: ${page.title}`);
  } catch (error) {
    console.error('Failed to store page in Redis:', error);
    throw error;
  }
}

export async function getPagesBySource(sourceUrl: string): Promise<PageData[]> {
  try {
    const sourceKey = `pages:${sourceUrl}`;
    const pageUrls = await redis.smembers(sourceKey);
    
    if (!pageUrls || pageUrls.length === 0) {
      return [];
    }

    const pages: PageData[] = [];
    
    for (const url of pageUrls) {
      const pageKey = `page:${url}`;
      const data = await redis.get(pageKey);
      
      if (data) {
        try {
          // Data is already a string, just parse it
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          pages.push(parsed);
        } catch (err) {
          console.error(`Failed to parse page ${url}:`, err);
          console.error('Data received:', typeof data, data);
        }
      }
    }
    
    return pages;
  } catch (error) {
    console.error('Failed to get pages from Redis:', error);
    return [];
  }
}

export async function deletePagesBySource(sourceUrl: string) {
  try {
    const sourceKey = `pages:${sourceUrl}`;
    const pageUrls = await redis.smembers(sourceKey);
    
    if (pageUrls && pageUrls.length > 0) {
      // Delete each page
      for (const url of pageUrls) {
        await redis.del(`page:${url}`);
      }
    }
    
    // Delete the source set
    await redis.del(sourceKey);
    
    console.log(`✓ Deleted ${pageUrls?.length || 0} pages from Redis`);
  } catch (error) {
    console.error('Failed to delete pages from Redis:', error);
    throw error;
  }
}
