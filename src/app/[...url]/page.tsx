import { ChatWrapper } from "@/components/ChatWrapper";
import { redis } from "@/lib/redis";
import { quickIndexPage } from "@/lib/quick-index";
import { getNamespaceStats } from "@/lib/pinecone-client";
import { startBackgroundCrawl } from "@/lib/background-crawler";
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
  
  // Must start with http:// or https://
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    const cleaned = raw.replace(/^https?:\/+/, "");
    return `https://${cleaned}`;
  }
  
  return raw;
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

const Page = async ({ params }: PageProps) => {
  const resolvedParams = await params;
  const reconstructedUrl = reconstructUrl({ url: resolvedParams.url as string[] });

  // Return 404 for invalid URLs
  if (!reconstructedUrl) {
    notFound();
  }

  const sessionId = `session_${reconstructedUrl.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const isAlreadyIndexed = await redis.sismember("indexed-urls", reconstructedUrl);

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

      // ✅ Start background crawl (fire and forget)
      startBackgroundCrawl({
        url: reconstructedUrl,
        sessionId,
        options: {
          maxDepth: 3,
          maxPages: 100,
          useJavaScript: needsJS,
        },
      }).catch((error) => {
        console.error('❌ Background crawl error:', error);
      });

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
              content: `⚠️ Error: ${error.message}`,
            },
          ]}
        />
      );
    }
  }

  // Already indexed - check current status
  const crawlStatus = await redis.hgetall(`crawl-status:${reconstructedUrl}`);
  const stats = await getNamespaceStats(reconstructedUrl);
  
  let statusMessage = `Hello! I have information about ${reconstructedUrl}. What would you like to know?`;
  
  if (crawlStatus?.status === 'completed') {
    const totalPages = (crawlStatus as Record<string, string>).newPagesIndexed || stats.vectorCount || 'multiple';
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
