'use client';

import { Message } from 'ai/react';
import { Bot, User } from 'lucide-react';

export const Messages = ({
  messages,
  isLoading,
}: {
  messages: Message[];
  isLoading: boolean;
}) => {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        <p>No messages yet. Start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
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
            <div className="prose prose-invert max-w-none">
              {message.content.split('\n').map((line, i) => (
                <p key={i} className="mb-2 last:mb-0">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      ))}

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
    </div>
  );
};
