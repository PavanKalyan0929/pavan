import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MessageSquare, Send, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const STARTER_QUESTIONS = [
  'How does SWAYAM–NPTEL credit transfer work in Andhra Pradesh engineering colleges?',
  'What documents should I keep ready for AP Post-Matric fee reimbursement verification?',
  'How do I escalate an unresolved hostel or fee grievance beyond my college?',
  'Explain AP EAPCET vs AP ECET eligibility for polytechnic diploma holders.',
];

export function AiAssistantView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Welcome to the Andhra Student Hub Guidance Desk. Ask me about AP college discovery, competitive exams (EAPCET, ECET, ICET, PGECET), NPTEL credit transfers, scholarship checklists, or grievance filing steps.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const nextHistory = [...messages, { role: 'user' as const, text: trimmed }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          history: messages,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to reach AI Assistant.');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.reply || 'No response received.' },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-[#1E40AF] dark:text-blue-400">
            Andhra Student Hub · Academic & Grievance Guidance
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            AI Student Assistant
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Informational academic guidance powered by server-side Gemini. Always verify official
            dates and fee policies on university and AP government portals.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Sparkles className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
            <span>Starter Questions</span>
          </div>
          <div className="space-y-2">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="w-full text-left p-3 text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors leading-relaxed cursor-pointer ash-btn-press"
              >
                {q}
              </button>
            ))}
          </div>
        </aside>

        <section className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col h-[580px]">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <MessageSquare className="w-4 h-4 text-[#1E40AF] dark:text-blue-400" />
            <span>Guidance Conversation</span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#1E40AF] dark:bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <motion.div
                  key="typing-indicator"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.16 }}
                  className="flex justify-start"
                >
                  <div className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 text-[#1E40AF] dark:text-blue-400">
                      <span className="ash-typing-dot" />
                      <span className="ash-typing-dot" />
                      <span className="ash-typing-dot" />
                    </span>
                    <span>Drafting response...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {error && (
            <div className="mx-5 mb-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 ash-animate-in">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about colleges, scholarships, EAPCET, NPTEL, or grievances..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E40AF] dark:focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#1E40AF] dark:bg-blue-600 rounded-lg hover:bg-[#1E3A8A] dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0 ash-btn-press"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
