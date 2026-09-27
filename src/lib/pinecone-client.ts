import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const indexName = process.env.PINECONE_INDEX_NAME!;

export function getNamespace(url: string): string {
  // Remove protocol
  let sanitized = url.replace(/^https?:\/\//, '');
  
  // Remove trailing slashes
  sanitized = sanitized.replace(/\/+$/, '');
  
  // Replace all special characters with hyphens
  sanitized = sanitized
    .replace(/[./]/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
  
  // Ensure not too long
  sanitized = sanitized.substring(0, 63);
  
  console.log(`✓ Namespace for "${url}": "${sanitized}"`);
  return sanitized;
}

// Embedding model is env-overridable, but WARNING: changing it on a
// non-empty index corrupts retrieval (vectors from different models are
// not comparable). Clear the Pinecone namespace after switching.
const embedModel = process.env.MISTRAL_EMBED_MODEL || 'mistral-embed';

// Generate embeddings using Mistral (with retry on 429)
export async function generateEmbedding(
  text: string,
  retries = 3
): Promise<number[]> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      body: JSON.stringify({
        model: embedModel,
        input: [text.substring(0, 8000)],
      }),
      });

      if (response.status === 401) {
        throw new Error(
          'Mistral 401 Unauthorized — your MISTRAL_API_KEY is invalid or revoked. Get a new one at console.mistral.ai.'
        );
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(1000 * 2 ** attempt, 8000);
        console.warn(
          `⏳ Mistral 429 rate-limited (attempt ${attempt + 1}/${retries + 1}). Retrying in ${waitMs}ms...`
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new Error(
          'Mistral 429 rate limit exceeded — free tier quota hit. Wait a minute and try again, or reduce background crawl size.'
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral API error ${response.status}: ${errorText.slice(0, 300)}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      lastError = error;
      // Don't retry auth errors
      if (error instanceof Error && error.message.includes('401')) throw error;
      // Network-level fetch failure: retry with backoff
      if (
        attempt < retries &&
        error instanceof Error &&
        (error.message.includes('fetch failed') || error.message.includes('429'))
      ) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (attempt >= retries) break;
      // For non-429 HTTP errors we already threw above; rethrow
      if (error instanceof Error && error.message.startsWith('Mistral API error')) throw error;
    }
  }

  console.error('❌ Embedding generation failed:', lastError);
  throw lastError;
}

// Chunk text into manageable pieces
function chunkText(text: string, maxLength: number = 6000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(c => c.length > 100);
}

// Store content in Pinecone with namespace isolation
export async function storeInPinecone(
  sourceUrl: string,
  pageUrl: string,
  title: string,
  content: string
) {
  try {
    if (!indexName) {
      throw new Error('PINECONE_INDEX_NAME is not configured');
    }
    const namespace = getNamespace(sourceUrl);
    const chunks = chunkText(content);
    
    console.log(`📦 Storing ${chunks.length} chunks in namespace: ${namespace}`);

    const index = pinecone.index(indexName);

    // Generate embeddings with bounded concurrency (2 at a time)
    // to stay under Mistral free-tier rate limits.
    const EMBED_CONCURRENCY = 2;
    const vectors: {
      id: string;
      values: number[];
      metadata: Record<string, string | number>;
    }[] = [];

    for (let i = 0; i < chunks.length; i += EMBED_CONCURRENCY) {
      const batch = chunks.slice(i, i + EMBED_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((chunk, offset) =>
          generateEmbedding(chunk).then((embedding) => ({
            id: `${Date.now()}_${i + offset}_${Math.random().toString(36).substring(7)}`,
            values: embedding,
            metadata: {
              sourceUrl,
              pageUrl,
              title,
              content: chunk,
              chunkIndex: i + offset,
              timestamp: new Date().toISOString(),
            },
          }))
        )
      );

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          vectors.push(result.value);
        } else {
          console.error('❌ Skipping chunk after embedding failure:', result.reason);
        }
      }

      // Space out embedding bursts so a long page doesn't hammer Mistral.
      if (i + EMBED_CONCURRENCY < chunks.length) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    if (vectors.length === 0) {
      throw new Error('All embedding requests failed');
    }

    // Upsert in batches of 100 (Pinecone limit)
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.namespace(namespace).upsert(batch);
    }

    console.log(`✅ Stored ${vectors.length} vectors in Pinecone namespace: "${namespace}"`);
    return vectors.length;
  } catch (error) {
    console.error('❌ Failed to store in Pinecone:', error);
    throw error;
  }
}

// Query Pinecone with namespace isolation
export async function queryPinecone(
  sourceUrl: string,
  query: string,
  topK: number = 5
) {
  try {
    const namespace = getNamespace(sourceUrl);
    const queryEmbedding = await generateEmbedding(query);
    
    const index = pinecone.index(indexName);
    const results = await index.namespace(namespace).query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    console.log(`🔍 Found ${results.matches?.length || 0} results in namespace: "${namespace}"`);

    return results.matches?.map(match => ({
      content: match.metadata?.content as string || '',
      title: match.metadata?.title as string || '',
      pageUrl: match.metadata?.pageUrl as string || '',
      score: match.score || 0,
    })) || [];
  } catch (error) {
    console.error('❌ Failed to query Pinecone:', error);
    return [];
  }
}

export async function deletePineconeNamespace(sourceUrl: string) {
  try {
    const namespace = getNamespace(sourceUrl);
    const index = pinecone.index(indexName);
    
    await index.namespace(namespace).deleteAll();
    
    console.log(`🗑️  Deleted entire namespace: "${namespace}"`);
  } catch (error) {
    console.error('❌ Failed to delete Pinecone namespace:', error);
    throw error;
  }
}

// Get stats for a namespace
export async function getNamespaceStats(sourceUrl: string) {
  try {
    const namespace = getNamespace(sourceUrl);
    const index = pinecone.index(indexName);
    
    const stats = await index.describeIndexStats();
    const namespaceStats = stats.namespaces?.[namespace];
    
    return {
      vectorCount: namespaceStats?.recordCount || 0,
      namespace,
    };
  } catch (error) {
    console.error('❌ Failed to get namespace stats:', error);
    return { vectorCount: 0, namespace: getNamespace(sourceUrl) };
  }
}
