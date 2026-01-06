export interface CrawlOptions {
  maxDepth?: number;
  maxPages?: number;
  useJavaScript?: boolean;
}

export interface BackgroundCrawlJob {
  url: string;
  sessionId: string;
  options: CrawlOptions;
}
