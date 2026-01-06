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

// Generate embeddings using Mistral
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: [text.substring(0, 8000)],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    throw error;
  }
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
    const namespace = getNamespace(sourceUrl);
    const chunks = chunkText(content);
    
    console.log(`📦 Storing ${chunks.length} chunks in namespace: ${namespace}`);

    const index = pinecone.index(indexName);
    const vectors = [];

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      
      vectors.push({
        id: `${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`,
        values: embedding,
        metadata: {
          sourceUrl,
          pageUrl,
          title,
          content: chunks[i],
          chunkIndex: i,
          timestamp: new Date().toISOString(),
        },
      });
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

// Delete entire namespace - FAST!
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
