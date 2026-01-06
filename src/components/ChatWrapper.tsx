"use client";
import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { CheckCircle2, X, Trash2, Database } from 'lucide-react'; 
import { Messages } from './Messages';
import { ChatInput } from './ChatInput';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatWrapperProps {
  sessionId: string;
  websiteUrl: string;
  initialMessages?: Message[];
}

export function ChatWrapper({ sessionId, websiteUrl, initialMessages = [] }: ChatWrapperProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  
  const notificationShownRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!websiteUrl || notificationShownRef.current) return;

    let pollCount = 0;
    const maxPolls = 360;

    const checkStatus = async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(interval);
        return;
      }

      try {
        const response = await fetch(
          `/api/crawl-status?url=${encodeURIComponent(websiteUrl)}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
        );

        if (!response.ok) return;
        const data = await response.json();

        if (data.status === 'completed' && !notificationShownRef.current) {
          setIndexedCount(data.newPagesIndexed || 0);
          setShowCompletionToast(true);
          notificationShownRef.current = true;
          clearInterval(interval);

          if ('Notification' in window && Notification.permission === 'granted') {
            const hostname = new URL(websiteUrl).hostname;
            new Notification('Indexing Complete! 🎉', {
              body: `Successfully indexed ${data.newPagesIndexed} pages from ${hostname}`,
              icon: '/favicon.ico',
            });
          }

          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch {}

        } else if (data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    };

    const interval = setInterval(checkStatus, 5000);
    checkStatus();
    return () => clearInterval(interval);
  }, [websiteUrl]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear this chat?')) {
      setMessages(initialMessages);
    }
  };

  const handleClearAllContent = async () => {
    const confirmed = confirm(
      '⚠️ WARNING: This will delete ALL indexed content from Redis and Pinecone for ALL websites.\n\n' +
      'This action cannot be undone. Are you sure?'
    );
    
    if (!confirmed) return;

    setIsClearing(true);
    try {
      const response = await fetch('/api/clear-context', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ Success!\n\nCleared ${data.urlsCleared} website(s) from the system.`);
        window.location.href = '/';
      } else {
        alert('❌ Failed to clear content: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Clear all error:', error);
      alert('❌ Failed to clear content. Check console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `${Date.now()}_user`,
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], sessionId }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');

      let assistantMessage = '';
      const assistantId = `${Date.now()}_assistant`;

      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantMessage += chunk;

        setMessages(prev => 
          prev.map(msg => msg.id === assistantId ? { ...msg, content: assistantMessage } : msg)
        );
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `${Date.now()}_error`,
        role: 'system',
        content: '❌ Failed to get response. Please try again.',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full bg-black text-white">
      
      {/* ✅ Sticky Header with Buttons */}
      <div className="sticky top-0 z-50 border-b border-slate-800 px-4 py-3 bg-black/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">Chat</h2>
            <p className="text-xs text-slate-400 truncate">{websiteUrl}</p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Clear Chat Button */}
            {messages.length > (initialMessages?.length || 0) && (
              <button
                onClick={handleClearChat}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
            )}

            {/* Clear All Content Button */}
            <button
              onClick={handleClearAllContent}
              disabled={isClearing}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-900/30"
            >
              {isClearing ? (
                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {isClearing ? 'Clearing...' : 'Clear All'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <Messages messages={messages} />
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-slate-800 p-4 bg-black">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>

      {/* Completion Toast */}
      {showCompletionToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl shadow-2xl border border-green-500/20 max-w-md">
            <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-bold text-lg">Indexing Complete! 🎉</h3>
              <p className="text-sm text-green-100">Successfully indexed {indexedCount} pages from {new URL(websiteUrl).hostname}</p>
            </div>
            <button 
              onClick={() => setShowCompletionToast(false)} 
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
