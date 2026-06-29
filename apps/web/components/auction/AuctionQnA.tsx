'use client';

import { useState } from 'react';
import { MessageSquare, CornerDownRight, Send, Bold, Italic, Link as LinkIcon, List, Image as ImageIcon } from 'lucide-react';

type Question = {
  id: number;
  user: string;
  isSeller: boolean;
  text: string;
  timestamp: string;
  replies?: Question[];
};

export function AuctionQnA() {
  const [threads, setThreads] = useState<Question[]>([
    {
      id: 1,
      user: 'Carrier_Omega',
      isSeller: false,
      text: 'Are there any special tarping requirements for this load?',
      timestamp: '2 hours ago',
      replies: [
        {
          id: 2,
          user: 'Global Freight Co.',
          isSeller: true,
          text: 'Yes, full lumber tarps are required to prevent moisture damage.',
          timestamp: '1 hour ago',
        }
      ]
    },
    {
      id: 3,
      user: 'Carrier_Zeta',
      isSeller: false,
      text: 'Is there a loading dock available or do we need a forklift on-site?',
      timestamp: '30 mins ago',
    }
  ]);

  const [newQuestion, setNewQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    
    setThreads([
      ...threads, 
      {
        id: Date.now(),
        user: 'You',
        isSeller: false,
        text: newQuestion,
        timestamp: 'Just now'
      }
    ]);
    setNewQuestion('');
  };

  return (
    <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col h-full shadow-sm">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <MessageSquare size={18} className="text-indigo-500" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-100 uppercase tracking-wider">
          Pre-Auction Discussion ({threads.length})
        </h3>
      </div>
      
      <div className="flex-1 overflow-auto p-4 space-y-6 bg-zinc-50 dark:bg-zinc-900">
        {threads.map(thread => (
          <div key={thread.id} className="space-y-3">
            <div className="bg-[#faf9f6] dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-md ${thread.isSeller ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                  {thread.user} {thread.isSeller && '(Seller)'}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase font-mono">{thread.timestamp}</span>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{thread.text}</p>
            </div>
            
            {thread.replies?.map(reply => (
              <div key={reply.id} className="ml-8 relative">
                <div className="absolute -left-6 top-4 border-l-2 border-b-2 border-zinc-200 dark:border-zinc-700 w-4 h-4 rounded-bl-xl"></div>
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${reply.isSeller ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                      {reply.user} {reply.isSeller && '(Seller)'}
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase font-mono">{reply.timestamp}</span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{reply.text}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-[#faf9f6] dark:bg-zinc-900 rounded-b-xl">
        <form onSubmit={handleSubmit} className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-shadow">
          
          {/* Advanced Editor Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <button type="button" className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="Bold">
              <Bold size={14} />
            </button>
            <button type="button" className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="Italic">
              <Italic size={14} />
            </button>
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
            <button type="button" className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="Link">
              <LinkIcon size={14} />
            </button>
            <button type="button" className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="Bullet List">
              <List size={14} />
            </button>
            <button type="button" className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors" title="Image">
              <ImageIcon size={14} />
            </button>
          </div>

          <div className="relative">
            <textarea 
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Ask a question about this shipment... (Markdown supported)" 
              className="w-full bg-[#faf9f6] dark:bg-zinc-900 pl-4 pr-12 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none resize-none min-h-[80px]"
            />
            <button 
              type="submit"
              disabled={!newQuestion.trim()}
              className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white rounded-md transition-colors shadow-sm"
            >
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
