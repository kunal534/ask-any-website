'use client';

import { Send } from 'lucide-react';
import { ChangeEvent, FormEvent } from 'react';

interface ChatInputProps {
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export const ChatInput = ({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
}: ChatInputProps) => {
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={input}
        onChange={handleInputChange}
        placeholder="Ask me anything about this website..."
        disabled={isLoading}
        className="flex-1 bg-zinc-700 border border-zinc-600 rounded-lg px-4 py-3 text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
      >
        <Send size={18} />
        Send
      </button>
    </form>
  );
};
