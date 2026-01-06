import axios from 'axios';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import puppeteer, { Browser, Page } from 'puppeteer';

interface CrawlResult {
  url: string;
  content: string;
  title: string;
  links: string[];
  pageType?: string;
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

  // ✅ NEW: Extract navigation links from homepage first
  private async getNavigationLinks(url: string): Promise<string[]> {
    const navLinks: string[] = [];
    
    try {
      if (this.browser) {
        const page = await this.browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const html = await page.content();
        const $ = cheerio.load(html);
        
        // ✅ Extract all navigation links (header, nav, menu)
        $('nav a, header a, [role="navigation"] a, .menu a, .navbar a').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            try {
              const absoluteUrl = new URL(href, url).href;
              const linkUrl = new URL(absoluteUrl);
              
              // Only same domain, no anchors, no files
              if (
                linkUrl.origin === this.baseUrl.origin &&
                !absoluteUrl.includes('#') &&
                !absoluteUrl.match(/\.(pdf|jpg|jpeg|png|gif|zip|exe|mp4|mp3)$/i)
              ) {
                navLinks.push(absoluteUrl);
              }
            } catch {}
          }
        });
        
        await page.close();
        console.log(`🧭 Found ${navLinks.length} navigation links:`, navLinks);
      } else {
        // Fallback for non-JS mode
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        $('nav a, header a, [role="navigation"] a').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            try {
              const absoluteUrl = new URL(href, url).href;
              if (new URL(absoluteUrl).origin === this.baseUrl.origin) {
                navLinks.push(absoluteUrl);
              }
            } catch {}
          }
        });
      }
    } catch (error) {
      console.error('Failed to extract navigation links:', error);
    }
    
    return [...new Set(navLinks)]; // Remove duplicates
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

    // ✅ First, get all navigation links from homepage
    console.log('🔍 Discovering navigation links...');
    const navLinks = await this.getNavigationLinks(this.startUrl);
    
    // ✅ Initialize queue with homepage + all nav links at depth 0
    const crawlQueue: { url: string; depth: number }[] = [
      { url: this.startUrl, depth: 0 },
      ...navLinks.map(link => ({ url: link, depth: 0 })), // All nav pages at same priority
    ];

    console.log(`📋 Starting crawl with ${crawlQueue.length} initial pages`);

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

  private getPageType(url: string): string {
    const path = new URL(url).pathname.toLowerCase();
    if (path.includes('archive')) return 'Archive';
    if (path.includes('thought')) return 'Thoughts';
    if (path.includes('affiliate')) return 'Affiliate';
    if (path.includes('feedback')) return 'Feedback';
    if (path.includes('stor')) return 'Story';
    if (path === '/' || path === '') return 'Homepage';
    return 'Page';
  }

  private extractStructuredContent($: cheerio.Root, url: string): string {
    const sections: string[] = [];
    const pageType = this.getPageType(url);
    
    sections.push(`=== ${pageType} ===`);
    sections.push(`URL: ${url}\n`);

    const mainTitle = $('h1').first().text().trim() || 
                     $('title').text().trim() ||
                     $('meta[property="og:title"]').attr('content')?.trim();
    
    if (mainTitle) {
      sections.push(`TITLE: ${mainTitle}\n`);
    }

    const category = $('nav a.active, .breadcrumb, .category').text().trim();
    if (category) {
      sections.push(`CATEGORY: ${category}\n`);
    }

    $('main, article, .content, [role="main"], body')
      .first()
      .find('h1, h2, h3, h4, h5, h6, p, li, blockquote, time')
      .each((_, element) => {
        const $el = $(element);
        const tagName = $el.get(0)?.name?.toLowerCase();
        if (!tagName) return;
        
        const text = $el.text().trim();
        if (text.length < 10) return;

        switch (tagName) {
          case 'h1':
            sections.push(`\n## ${text}`);
            break;
          case 'h2':
            sections.push(`\n### ${text}`);
            break;
          case 'h3':
            sections.push(`\n#### ${text}`);
            break;
          case 'h4':
          case 'h5':
          case 'h6':
            sections.push(`\n##### ${text}`);
            break;
          case 'p':
            if (text.length > 20) {
              sections.push(text);
            }
            break;
          case 'li':
            sections.push(`• ${text}`);
            break;
          case 'blockquote':
            sections.push(`> ${text}`);
            break;
          case 'time':
            const datetime = $el.attr('datetime');
            sections.push(`DATE: ${datetime || text}`);
            break;
        }
      });

    const tags: string[] = [];
    $('a[href*="tag"], .tag, .badge, [class*="tag"]').each((_, el) => {
      const tag = $(el).text().trim();
      if (tag.length > 0 && tag.length < 30) {
        tags.push(tag);
      }
    });
    
    if (tags.length > 0) {
      sections.push(`\nTAGS: ${[...new Set(tags)].join(', ')}`);
    }

    sections.push('\n=== END ===\n');

    return sections.join('\n').trim();
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

      await new Promise(resolve => setTimeout(resolve, 2000));

      const html = await page.content();
      const $ = cheerio.load(html);

      $('script, style, nav, footer, header, iframe, noscript, [role="navigation"], .ads, .advertisement').remove();

      const content = this.extractStructuredContent($, url);

      let title = await page.title();
      const h1Text = $('h1').first().text().trim();
      const metaTitle = $('meta[property="og:title"]').attr('content')?.trim();
      const articleTitle = $('article h1, .story-title, .post-title, .entry-title').first().text().trim();
      
      if (!title || title === 'Midnight Horror Tales' || title.length < 3) {
        title = articleTitle || metaTitle || h1Text || this.getPageType(url);
      }
      
      title = title.replace(/\s+/g, ' ').trim().substring(0, 200);

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
        } catch {}
      }

      if (content.length > 100) {
        this.results.push({ 
          url, 
          content, 
          title, 
          links,
          pageType: this.getPageType(url)
        });
        console.log(`✓ [${this.getPageType(url)}] ${title} | ${content.length} chars`);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(`✗ Failed: ${url} - ${error.message}`);
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
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      if (status !== 200) return;

      const $ = cheerio.load(data);
      $('script, style, nav, footer, header, iframe, noscript, .ads').remove();

      const content = this.extractStructuredContent($, url);

      const pageTitle = $('title').text().trim();
      const h1Text = $('h1').first().text().trim();
      const metaTitle = $('meta[property="og:title"]').attr('content')?.trim();
      const articleTitle = $('article h1, .story-title, .post-title').first().text().trim();
      
      const title = articleTitle || metaTitle || pageTitle || h1Text || this.getPageType(url);

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
                           !absoluteUrl.includes('#');

          if (isHttp && isContent && notVisited && notQueued) {
            if (!sameDomainOnly || isSameDomain) {
              links.push(absoluteUrl);
              
              if (depth < maxDepth) {
                crawlQueue.push({ url: absoluteUrl, depth: depth + 1 });
              }
            }
          }
        } catch {}
      });

      if (content.length > 100) {
        this.results.push({ 
          url, 
          content, 
          title, 
          links,
          pageType: this.getPageType(url)
        });
        console.log(`✓ [${this.getPageType(url)}] ${title}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`✗ Failed: ${url} - ${error.message}`);
      }
    }
  }

  getStats() {
    return {
      pagesVisited: this.visited.size,
      pagesIndexed: this.results.length,
      totalCharacters: this.results.reduce((sum, r) => sum + r.content.length, 0),
      pageTypes: this.results.reduce((acc, r) => {
        const type = r.pageType || 'Unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
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
  console.log('\n📊 Crawl Stats:');
  console.log(`   Pages Visited: ${stats.pagesVisited}`);
  console.log(`   Pages Indexed: ${stats.pagesIndexed}`);
  console.log(`   Total Characters: ${stats.totalCharacters.toLocaleString()}`);
  console.log(`   Page Types:`, stats.pageTypes);
  
  return results;
}
