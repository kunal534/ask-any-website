'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Messages } from './Messages';
import { ChatInput } from './ChatInput';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWrapperProps {
  sessionId: string;
  initialMessages: Message[];
  backgroundCrawlUrl?: string;
  backgroundCrawlOptions?: {
    maxDepth?: number;
    maxPages?: number;
    useJavaScript?: boolean;
  };
  currentUrl: string;
}

export const ChatWrapper = ({
  sessionId,
  initialMessages,
  backgroundCrawlUrl,
  backgroundCrawlOptions,
  currentUrl,
}: ChatWrapperProps) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (backgroundCrawlUrl && backgroundCrawlOptions) {
      console.log('Starting background crawl for:', backgroundCrawlUrl);
      
      fetch('/api/background-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: backgroundCrawlUrl,
          sessionId,
          options: backgroundCrawlOptions,
        }),
      }).catch(err => console.error('Background crawl failed:', err));
    }
  }, [backgroundCrawlUrl, backgroundCrawlOptions, sessionId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const text = decoder.decode(value);
          assistantMessage.content += text;
          
          setMessages(prev => [
            ...prev.slice(0, -1),
            { ...assistantMessage },
          ]);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, an error occurred. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearContext = async () => {
    try {
      const response = await fetch('/api/clear-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentUrl, sessionId }),
      });

      if (response.ok) {
        setMessages([
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: '✅ Context cleared! Refresh the page to re-index.',
          },
        ]);
      }
    } catch (error) {
      console.error('Failed to clear context:', error);
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-900 text-white flex flex-col">
      <div className="sticky top-0 z-10 bg-zinc-800 border-b border-zinc-700 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Website Chat</h1>
            <p className="text-sm text-zinc-400 truncate max-w-xl">{currentUrl}</p>
          </div>
          <button
            onClick={handleClearContext}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            Clear Context
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4">
          <Messages messages={messages} isLoading={isLoading} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-zinc-800 border-t border-zinc-700 p-4">
        <div className="max-w-4xl mx-auto">
          <ChatInput
            input={input}
            handleInputChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
