import { ChatWrapper } from "@/components/ChatWrapper";
import { redis } from "@/lib/redis";
import { quickIndexPage } from "@/lib/quick-index";
import { getNamespaceStats } from "@/lib/pinecone-client";
import { startBackgroundCrawl } from "@/lib/background-crawler";
import { sessionIdForUrl } from "@/lib/session";
import { isAllowedUrl } from "@/lib/url-guard";
import { after } from "next/server";
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ url: string[] }>;
}

function reconstructUrl({ url }: { url: string[] }): string | null {
  const raw = decodeURIComponent(url.join("/"));
  
  // Block meta files and API routes
  const blockedPaths = [
    'sw.js', 'service-worker.js', 'manifest.json', 
    'favicon.ico', 'robots.txt', 'sitemap.xml',
    'api/', '_next/', 'static/'
  ];
  
  if (blockedPaths.some(path => raw.includes(path))) {
    return null;
  }
  
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    const cleaned = raw.replace(/^https?:\/+/, "");
    return `https://${cleaned}`;
  }
  
  return raw;
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function redisErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("ENOTFOUND") ||
    msg.includes("fetch failed") ||
    msg.includes("Failed to fetch")
  ) {
    return `⚠️ Cannot reach Redis (Upstash). Check UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in your .env — the configured host does not resolve.\n\nDetails: ${msg}`;
  }
  return `⚠️ Storage error: ${msg}`;
}

const Page = async ({ params }: PageProps) => {
  const resolvedParams = await params;
  const reconstructedUrl = reconstructUrl({ url: resolvedParams.url as string[] });

  // Return 404 for invalid URLs
  if (!reconstructedUrl) {
    notFound();
  }

  const sessionId = sessionIdForUrl(reconstructedUrl);

  if (!isAllowedUrl(reconstructedUrl)) {
    return (
      <ChatWrapper
        sessionId={sessionId}
        websiteUrl={reconstructedUrl}
        initialMessages={[
          {
            id: generateId(),
            role: "system",
            content: `⚠️ This URL is not allowed. Only public http(s) websites with default ports are supported.`,
          },
        ]}
      />
    );
  }

  let isAlreadyIndexed: boolean;
  try {
    isAlreadyIndexed = (await redis.sismember(
      "indexed-urls",
      reconstructedUrl
    )) as unknown as boolean;
  } catch (err) {
    console.error("❌ Redis unavailable (sismember):", err);
    return (
      <ChatWrapper
        sessionId={sessionId}
        websiteUrl={reconstructedUrl}
        initialMessages={[
          {
            id: generateId(),
            role: "system",
            content: redisErrorMessage(err),
          },
        ]}
      />
    );
  }

  if (!isAlreadyIndexed) {
    try {
      console.log(`⚡ Quick indexing homepage: ${reconstructedUrl}`);
      
      const jsHeavySites = [
        'leetcode.com',
        'reddit.com',
        'twitter.com',
        'medium.com',
        'vercel.app',
        'dev.to',
      ];
      const needsJS = jsHeavySites.some(site => reconstructedUrl.includes(site));

      const homepageResult = await quickIndexPage(reconstructedUrl, needsJS);

      if (!homepageResult.success) {
        throw new Error("Could not extract content from homepage");
      }

      await redis.sadd("indexed-urls", reconstructedUrl);
      
      await redis.hset(`crawl-status:${reconstructedUrl}`, {
  status: 'crawling',
  sessionId,
  startedAt: new Date().toISOString(),
  totalPages: '0',
  newPagesIndexed: '0',
});

      console.log(`✅ Homepage indexed successfully`);

      // Schedule background crawl with Next `after()` so it survives
      // response streaming on serverless. The ChatWrapper also triggers
      // POST /api/background-crawl as a fallback if status stays stale.
      const crawlJob = {
        url: reconstructedUrl,
        sessionId,
        options: {
          maxDepth: 3,
          maxPages: 100,
          useJavaScript: needsJS,
        },
      };
      after(() =>
        startBackgroundCrawl(crawlJob).catch((error) => {
          console.error('❌ Background crawl error:', error);
        })
      );

      return (
        <ChatWrapper
          sessionId={sessionId}
          websiteUrl={reconstructedUrl}
          initialMessages={[
            {
              id: generateId(),
              role: "assistant",
              content: `📚 I've indexed the homepage of **${homepageResult.title}** and you can start asking questions now!\n\n🔄 I'm crawling the rest of the site in the background to gather more information. You'll get a notification when it's complete!\n\n📍 Site: ${reconstructedUrl}`,
            },
          ]}
        />
      );

    } catch (err) {
      const error = err as Error;
      console.error("❌ Failed to index:", error);

      return (
        <ChatWrapper
          sessionId={sessionId}
          websiteUrl={reconstructedUrl}
          initialMessages={[
            {
              id: generateId(),
              role: "system",
              content: redisErrorMessage(error),
            },
          ]}
        />
      );
    }
  }

  // Already indexed - check current status (never let storage errors crash the page)
  let crawlStatus: Record<string, string> | null = null;
  let vectorCount = 0;
  try {
    const raw = await redis.hgetall(`crawl-status:${reconstructedUrl}`);
    crawlStatus = raw as Record<string, string> | null;
  } catch (err) {
    console.error("❌ Redis unavailable (hgetall):", err);
  }
  try {
    const stats = await getNamespaceStats(reconstructedUrl);
    vectorCount = stats.vectorCount;
  } catch (err) {
    console.error("❌ Pinecone stats failed:", err);
  }
  
  let statusMessage = `Hello! I have information about ${reconstructedUrl}. What would you like to know?`;
  
  if (crawlStatus?.status === 'completed') {
    const totalPages = crawlStatus.newPagesIndexed || vectorCount || 'multiple';
    statusMessage = `📚 I have fully indexed **${totalPages} pages** from this site. Ask me anything!\n\n📍 Site: ${reconstructedUrl}`;
  } else if (crawlStatus?.status === 'crawling') {
    statusMessage = `🔄 Currently indexing pages in the background. You can start chatting now, and I'll notify you when indexing is complete!\n\n📍 Site: ${reconstructedUrl}`;
  }

  return (
    <ChatWrapper
      sessionId={sessionId}
      websiteUrl={reconstructedUrl}
      initialMessages={[
        {
          id: generateId(),
          role: "assistant",
          content: statusMessage,
        },
      ]}
    />
  );
};

export default Page;
