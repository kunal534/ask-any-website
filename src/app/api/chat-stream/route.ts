import { queryPinecone } from "@/lib/pinecone-client";
import { getPagesBySource } from "@/lib/context-retrieval";
import { redis } from "@/lib/redis";
import { resolveUrlFromSessionId } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

export const POST = async (req: Request) => {
  try {
    const { messages, sessionId } = await req.json();

    console.log('=== CHAT REQUEST START ===');
    console.log('SessionID:', sessionId);

    if (typeof sessionId !== 'string' || !sessionId.startsWith('session_')) {
      return Response.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Messages required' }, { status: 400 });
    }

    const { allowed } = await checkRateLimit(`chat:${sessionId}`, 30, 60);
    if (!allowed) {
      return Response.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 });
    }

    const allIndexedUrls = await redis.smembers("indexed-urls");
    const actualUrl = resolveUrlFromSessionId(sessionId, allIndexedUrls);

    if (!actualUrl) {
      return Response.json({ error: 'Unknown session. Please re-index the website.' }, { status: 404 });
    }

    console.log('✓ Using URL:', actualUrl);

    const lastMessage = messages[messages.length - 1]?.content;
    if (typeof lastMessage !== 'string' || !lastMessage.trim()) {
      return Response.json({ error: 'Invalid message' }, { status: 400 });
    }
    const question = lastMessage.slice(0, 2000);

    const vectorResults = await queryPinecone(actualUrl, question, 5);
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

      return streamMistral(actualUrl, context, question, messages);
    }

    const context = vectorResults
      .map(r => `### ${r.title}\n\n${r.content}`)
      .join('\n\n---\n\n');

    return streamMistral(actualUrl, context, question, messages);
    
  } catch (error) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const isRedisDown =
      msg.includes('ENOTFOUND') || msg.includes('fetch failed');
    return Response.json(
      {
        error: isRedisDown
          ? 'Storage unavailable (Redis unreachable). Check UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.'
          : 'Internal error',
      },
      { status: isRedisDown ? 503 : 500 }
    );
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

  const chatModel = process.env.MISTRAL_CHAT_MODEL || 'ministral-8b-2512';

  try {
    let response: Response | null = null;
    let last429Body = '';

    // Retry the initial chat request on 429 (before streaming starts).
    // The crawl just burned through quota, so give Mistral time to recover.
    for (let attempt = 0; attempt <= 2; attempt++) {
      response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: chatModel,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
      });

      if (response.ok) break;

      const body = await response.text().catch(() => '');
      if (response.status === 401) {
        console.error(`Mistral chat failed: 401 ${body.slice(0, 300)}`);
        throw new Error(
          'Mistral 401 Unauthorized — your MISTRAL_API_KEY is invalid or revoked. Get a new one at console.mistral.ai and update .env.'
        );
      }
      if (response.status === 429) {
        last429Body = body.slice(0, 300);
        const retryAfter = response.headers.get('retry-after');
        const waitMs =
          retryAfter && Number(retryAfter) > 0
            ? Number(retryAfter) * 1000
            : Math.min(4000 * (attempt + 1), 15000);
        console.warn(
          `⏳ Mistral chat 429 (attempt ${attempt + 1}/3). Retrying in ${waitMs}ms... ${last429Body}`
        );
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new Error(
          'Mistral rate limit hit (429) — the crawl just used up the quota. Wait 1–2 minutes and try again. If this persists, check usage at console.mistral.ai or set MISTRAL_CHAT_MODEL to a model with more headroom.'
        );
      }

      console.error(`Mistral chat failed: ${response.status} ${body.slice(0, 300)}`);
      throw new Error(`Mistral error: ${response.status}`);
    }

    if (!response || !response.ok) {
      throw new Error('Mistral error: no response');
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
