import axios from 'axios';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import puppeteer, { Browser, Page } from 'puppeteer';

interface CrawlResult {
  url: string;
  content: string;
  title: string;
  links: string[];
}

interface CrawlOptions {
  maxDepth?: number;
  maxPages?: number;
  delayMs?: number;
  timeout?: number;
  sameDomainOnly?: boolean;
  useJavaScript?: boolean;
}

export class DeepCrawler {
  private visited = new Set<string>();
  private results: CrawlResult[] = [];
  private queue: PQueue;
  private baseUrl: URL;
  private browser: Browser | null = null;

  constructor(
    private startUrl: string,
    private options: CrawlOptions = {}
  ) {
    this.baseUrl = new URL(startUrl);
    
    this.queue = new PQueue({
      concurrency: options.useJavaScript ? 1 : 2,
      interval: options.delayMs || 1000,
      intervalCap: 1,
    });
  }

  async crawl(): Promise<CrawlResult[]> {
    const {
      maxDepth = 2,
      maxPages = 50,
      sameDomainOnly = true,
      useJavaScript = false,
    } = this.options;

    if (useJavaScript) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      console.log('🌐 Browser launched for JavaScript rendering');
    }

    const crawlQueue: { url: string; depth: number }[] = [
      { url: this.startUrl, depth: 0 },
    ];

    try {
      while (crawlQueue.length > 0 && this.results.length < maxPages) {
        const batch = crawlQueue.splice(0, useJavaScript ? 2 : 5);

        await Promise.allSettled(
          batch.map(({ url, depth }) =>
            this.queue.add(() =>
              useJavaScript
                ? this.crawlPageWithJS(url, depth, maxDepth, sameDomainOnly, crawlQueue)
                : this.crawlPage(url, depth, maxDepth, sameDomainOnly, crawlQueue)
            )
          )
        );
      }
    } finally {
      if (this.browser) {
        await this.browser.close();
        console.log('🔒 Browser closed');
      }
    }

    return this.results;
  }

  private async crawlPageWithJS(
    url: string,
    depth: number,
    maxDepth: number,
    sameDomainOnly: boolean,
    crawlQueue: { url: string; depth: number }[]
  ): Promise<void> {
    if (this.visited.has(url) || depth > maxDepth || !this.browser) {
      return;
    }

    this.visited.add(url);

    let page: Page | null = null;

    try {
      page = await this.browser.newPage();
      
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout || 30000,
      });

      // Wait for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      const html = await page.content();
      const $ = cheerio.load(html);

      $('script, style, nav, footer, header, iframe, noscript, [role="navigation"]').remove();

      const content = $('body')
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      const title = await page.title() || $('h1').first().text().trim() || url;

      const links: string[] = [];
      const hrefs = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => a.getAttribute('href'))
      );

      for (const href of hrefs) {
        if (!href) continue;

        try {
          const absoluteUrl = new URL(href, url).href;
          const linkUrl = new URL(absoluteUrl);

          const isSameDomain = linkUrl.origin === this.baseUrl.origin;
          const isHttp = linkUrl.protocol === 'http:' || linkUrl.protocol === 'https:';
          const notVisited = !this.visited.has(absoluteUrl);
          const notQueued = !crawlQueue.some((item) => item.url === absoluteUrl);
          
          const isContent = !absoluteUrl.match(/\.(pdf|jpg|jpeg|png|gif|zip|exe|mp4|mp3)$/i) &&
                           !absoluteUrl.includes('#') &&
                           !absoluteUrl.includes('logout') &&
                           !absoluteUrl.includes('login');

          if (isHttp && isContent && notVisited && notQueued) {
            if (!sameDomainOnly || isSameDomain) {
              links.push(absoluteUrl);
              
              if (depth < maxDepth) {
                crawlQueue.push({ url: absoluteUrl, depth: depth + 1 });
              }
            }
          }
        } catch (err) {
          // Invalid URL, skip
        }
      }

      if (content.length > 100) {
        this.results.push({ url, content, title, links });
        console.log(`✓ Crawled (JS): ${url} (${content.length} chars, ${links.length} links)`);
      } else {
        console.warn(`⚠ Skipped ${url}: insufficient content (${content.length} chars)`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ Failed to crawl ${url}: ${error.message}`);
      }
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async crawlPage(
    url: string,
    depth: number,
    maxDepth: number,
    sameDomainOnly: boolean,
    crawlQueue: { url: string; depth: number }[]
  ): Promise<void> {
    if (this.visited.has(url) || depth > maxDepth) {
      return;
    }

    this.visited.add(url);

    try {
      const { data, status } = await axios.get(url, {
        timeout: this.options.timeout || 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CustomBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      if (status !== 200) {
        console.warn(`Non-200 status for ${url}: ${status}`);
        return;
      }

      const $ = cheerio.load(data);

      $('script, style, nav, footer, header, iframe, noscript').remove();

      const content = $('body')
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      const title = $('title').text().trim() || $('h1').first().text().trim() || url;

      const links: string[] = [];
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        try {
          const absoluteUrl = new URL(href, url).href;
          const linkUrl = new URL(absoluteUrl);

          const isSameDomain = linkUrl.origin === this.baseUrl.origin;
          const isHttp = linkUrl.protocol === 'http:' || linkUrl.protocol === 'https:';
          const notVisited = !this.visited.has(absoluteUrl);
          const notQueued = !crawlQueue.some((item) => item.url === absoluteUrl);
          
          const isContent = !absoluteUrl.match(/\.(pdf|jpg|jpeg|png|gif|zip|exe|mp4|mp3)$/i) &&
                           !absoluteUrl.includes('#') &&
                           !absoluteUrl.includes('logout') &&
                           !absoluteUrl.includes('login');

          if (isHttp && isContent && notVisited && notQueued) {
            if (!sameDomainOnly || isSameDomain) {
              links.push(absoluteUrl);
              
              if (depth < maxDepth) {
                crawlQueue.push({ url: absoluteUrl, depth: depth + 1 });
              }
            }
          }
        } catch (err) {
          // Invalid URL, skip
        }
      });

      if (content.length > 100) {
        this.results.push({ url, content, title, links });
        console.log(`✓ Crawled: ${url} (${content.length} chars, ${links.length} links)`);
      } else {
        console.warn(`⚠ Skipped ${url}: insufficient content`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`✗ Failed to crawl ${url}: ${error.message}`);
      } else {
        console.error(`✗ Failed to crawl ${url}:`, error);
      }
    }
  }

  getStats() {
    return {
      pagesVisited: this.visited.size,
      pagesIndexed: this.results.length,
      totalCharacters: this.results.reduce((sum, r) => sum + r.content.length, 0),
    };
  }
}

export async function deepCrawl(
  startUrl: string,
  options?: CrawlOptions
): Promise<CrawlResult[]> {
  const crawler = new DeepCrawler(startUrl, options);
  const results = await crawler.crawl();
  
  const stats = crawler.getStats();
  console.log('\n📊 Crawl Stats:', stats);
  
  return results;
}
