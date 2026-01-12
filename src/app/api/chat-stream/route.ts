import { queryPinecone } from "@/lib/pinecone-client";
import { getPagesBySource } from "@/lib/context-retrieval";
import { redis } from "@/lib/redis";

export const POST = async (req: Request) => {
  try {
    const { messages, sessionId } = await req.json();

    console.log('=== CHAT REQUEST START ===');
    console.log('SessionID:', sessionId);

    const urlMatch = sessionId.match(/session_(.+)/);
    if (!urlMatch) {
      return Response.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const urlPart = urlMatch[1];
    let reconstructedUrl = urlPart
      .replace(/https_/g, 'https://')
      .replace(/http_/g, 'http://')
      .replace(/_/g, '.');

    if (!reconstructedUrl.startsWith('http')) {
      reconstructedUrl = 'https://' + reconstructedUrl;
    }

    const allIndexedUrls = await redis.smembers("indexed-urls");
    let actualUrl = reconstructedUrl;
    
    if (allIndexedUrls && allIndexedUrls.length > 0) {
      const match = allIndexedUrls.find(url => {
        const sessionFromUrl = `session_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
        return sessionFromUrl === sessionId;
      });
      if (match) actualUrl = match;
    }

    console.log('✓ Using URL:', actualUrl);

    const lastMessage = messages[messages.length - 1].content;

    const vectorResults = await queryPinecone(actualUrl, lastMessage, 5);
    console.log(`Pinecone: ${vectorResults.length} results`);

    if (vectorResults.length === 0) {
      const storedPages = await getPagesBySource(actualUrl);
      
      if (storedPages.length === 0) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const msg = `I don't have any indexed content from ${actualUrl} yet.`;
            controller.enqueue(encoder.encode(msg));
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
          },
        });
      }

      const context = storedPages.slice(0, 3)
        .map(p => `### ${p.title}\n\n${p.content.substring(0, 2000)}`)
        .join('\n\n---\n\n');

      return streamMistral(actualUrl, context, lastMessage, messages);
    }

    const context = vectorResults
      .map(r => `### ${r.title}\n\n${r.content}`)
      .join('\n\n---\n\n');

    return streamMistral(actualUrl, context, lastMessage, messages);
    
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

interface Message{
  role:'user' | 'assistant' |'system';
  content: string;
}
async function streamMistral(
  url: string,
  context: string,
  question: string,
  messages: Message[]
) {
  const chatHistory = messages.slice(0, -1)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .slice(-5)
    .join('\n');

  const prompt = `You are analyzing: ${url}

RELEVANT CONTENT:
${context.substring(0, 8000)}

CONVERSATION HISTORY:
${chatHistory}

USER QUESTION:
${question}

Provide a detailed answer based only on the content above:`;

  console.log('Calling Mistral...');

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral error: ${response.status}`);
    }

    console.log('✓ Streaming response');

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const reader = response.body?.getReader();
    
    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }

        try {
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('✓ Stream complete');
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                
                if (data === '[DONE]') continue;
                if (!data) continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (error) {
                   console.error('Stream error:', error);
                }
              }
            }
          }
          
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    console.error('Mistral failed:', error);
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`Error: ${(error as Error).message}`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}
