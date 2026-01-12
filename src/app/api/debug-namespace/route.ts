import { Pinecone } from '@pinecone-database/pinecone';
import { getNamespace } from '@/lib/pinecone-client';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return Response.json({
      error: 'URL parameter is required'
    }, { status: 400 });
  }
  
  const namespace = getNamespace(url);
  
  const indexName = process.env.PINECONE_INDEX_NAME || 'chatbot';
  const index = pinecone.index(indexName);
  
  try {
    const stats = await index.describeIndexStats();
    
    return Response.json({
      url,
      indexName, 
      expectedNamespace: namespace,
      allNamespaces: stats.namespaces,
      namespaceExists: !!stats.namespaces?.[namespace],
      vectorCount: stats.namespaces?.[namespace]?.recordCount || 0,
    });
  } catch (error) {
    return Response.json({
      error: (error as Error).message,
    }, { status: 500 });
  }
}
