'use client';

import { Bot, User } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface MessagesProps {
  messages: Message[];
  isLoading?: boolean;
}

// Function to remove markdown formatting
const stripMarkdown = (text: string): string => {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/```[\s\S]+?```/g, '')
    .replace(/~~(.+?)~~/g, '$1');
};

export const Messages = ({ messages, isLoading }: MessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        <p>No messages yet. Start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        const displayContent = stripMarkdown(message.content);
        
        return (
          <div
            key={message.id || `msg-${index}`}
            className={`flex gap-4 p-4 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-900/20 ml-8'
                : 'bg-zinc-800 mr-8'
            }`}
          >
            <div className="flex-shrink-0">
              {message.role === 'user' ? (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                  <User size={20} />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                  <Bot size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="font-semibold text-sm text-zinc-400">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="text-white whitespace-pre-wrap">
                {displayContent.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 last:mb-0">
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-4 p-4 rounded-lg bg-zinc-800 mr-8">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <Bot size={20} />
            </div>
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-zinc-400 mb-2">Assistant</div>
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      
      {/* Invisible div at the bottom to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
};
