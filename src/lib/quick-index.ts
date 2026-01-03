import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import { storePageContent } from './context-retrieval';
import { storeInPinecone } from './pinecone-client';

interface QuickIndexResult {
  url: string;
  content: string;
  title: string;
  success: boolean;
}

export async function quickIndexPage(
  url: string,
  useJavaScript: boolean = false
): Promise<QuickIndexResult> {
  try {
    const result = useJavaScript 
      ? await quickIndexWithJS(url)
      : await quickIndexWithAxios(url);

    if (result.success) {
      // Store in Redis for quick access
      await storePageContent({
        url: result.url,
        title: result.title,
        content: result.content,
        sourceUrl: url,
        timestamp: new Date().toISOString(),
      });

      // Store in Pinecone for semantic search
      await storeInPinecone(url, result.url, result.title, result.content);
    }

    return result;
  } catch (error) {
    console.error(`Quick index failed for ${url}:`, error);
    return {
      url,
      content: '',
      title: '',
      success: false,
    };
  }
}

async function quickIndexWithAxios(url: string): Promise<QuickIndexResult> {
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const $ = cheerio.load(data);
  
  $('script, style, noscript, nav, footer, header').remove();

  const bodyText = $('body').text();
  const mainText = $('main, article, [role="main"], .content, #content').text();
  const content = (mainText || bodyText)
    .replace(/\s+/g, ' ')
    .trim();
  
  const title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                $('meta[property="og:title"]').attr('content') ||
                url;

  const description = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content') || 
                     '';

  const fullContent = `${description}\n\n${content}`.trim();

  console.log(`✓ Extracted: ${fullContent.length} chars from ${url}`);

  return {
    url,
    content: fullContent,
    title,
    success: fullContent.length > 100,
  };
}

async function quickIndexWithJS(url: string): Promise<QuickIndexResult> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const html = await page.content();
    const $ = cheerio.load(html);
    
    $('script, style, noscript, nav, footer, header').remove();

    const bodyText = $('body').text();
    const mainText = $('main, article, [role="main"], .content, #content').text();
    const content = (mainText || bodyText)
      .replace(/\s+/g, ' ')
      .trim();

    const title = await page.title() || 
                  $('h1').first().text().trim() || 
                  url;

    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       '';

    const fullContent = `${description}\n\n${content}`.trim();

    console.log(`✓ Extracted (JS): ${fullContent.length} chars from ${url}`);

    return {
      url,
      content: fullContent,
      title,
      success: fullContent.length > 100,
    };
  } finally {
    await browser.close();
  }
}
