import { Pinecone } from '@pinecone-database/pinecone';
import { getNamespace } from '@/lib/pinecone-client';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url') || 'https://midnight-horror.vercel.app';
  
  const namespace = getNamespace(url);
  const index = pinecone.index('chatbot');
  
  try {
    const stats = await index.describeIndexStats();
    
    return Response.json({
      url,
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
