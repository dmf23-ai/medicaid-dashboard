"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  // Reserved for the future hybrid model: a message may carry a
  // structured action payload that the UI will render as a card
  // alongside the prose. For the UI skeleton, this slot is always null.
  action?: null;
}

export default function AskClaude() {
  const [isOpen, setIsOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);

  const drawerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Stop the pulse after a few iterations to avoid distraction
  useEffect(() => {
    const timer = setTimeout(() => setPulse(false), 9000);
    return () => clearTimeout(timer);
  }, []);

  // Cmd/Ctrl+K to toggle, Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Focus the input shortly after the drawer slides in
      const id = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(id);
    } else {
      // Return focus to trigger when closing
      buttonRef.current?.focus();
    }
  }, [isOpen]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data: { text?: string } = await res.json();
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text: data.text ?? "No response.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: "assistant",
        text:
          "Sorry — I couldn't reach the assistant backend. This is a UI skeleton; the real API will be wired up in a later phase.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
      console.error("Ask Claude fetch error:", err);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating action button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen(true);
          setPulse(false);
        }}
        aria-label="Open Ask Claude (Cmd/Ctrl+K)"
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-950 ${
          pulse ? "ask-claude-pulse" : ""
        }`}
        style={{
          background:
            "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
          color: "#FFFFFF",
          boxShadow:
            "0 10px 30px rgba(249, 115, 22, 0.35), 0 2px 6px rgba(0, 0, 0, 0.4)",
        }}
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-semibold">Ask Claude</span>
        <kbd className="hidden sm:inline-block text-[10px] font-mono bg-white/20 rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-claude-heading"
        className={`fixed top-0 right-0 h-full z-50 w-full sm:w-[420px] flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "var(--bg-surface, #111827)",
          borderLeft: "1px solid var(--border-subtle, #1E293B)",
          boxShadow: isOpen
            ? "-20px 0 40px rgba(0, 0, 0, 0.5)"
            : "none",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border-subtle, #1E293B)" }}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              className="w-4 h-4"
              style={{ color: "var(--texas-primary, #F97316)" }}
            />
            <h2
              id="ask-claude-heading"
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary, #F1F5F9)" }}
            >
              Ask Claude
            </h2>
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{
                background: "rgba(249, 115, 22, 0.15)",
                color: "var(--texas-primary, #F97316)",
                border: "1px solid rgba(249, 115, 22, 0.3)",
              }}
            >
              Preview
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close Ask Claude"
            className="p-1 rounded-md transition-colors hover:bg-slate-800"
            style={{ color: "var(--text-secondary, #94A3B8)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
          )}
          {isSending && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Thinking…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          className="px-5 py-4 border-t"
          style={{ borderColor: "var(--border-subtle, #1E293B)" }}
        >
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about any state, trend, or source…"
              disabled={isSending}
              className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
              style={{
                background: "var(--bg-deep, #0A0E1A)",
                border: "1px solid var(--border-subtle, #1E293B)",
                color: "var(--text-primary, #F1F5F9)",
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              aria-label="Send question"
              className="p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background:
                  "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
                color: "#FFFFFF",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p
            className="mt-2 text-[10px]"
            style={{ color: "var(--text-muted, #475569)" }}
          >
            UI preview — real answers will ship in a later phase.
          </p>
        </div>
      </aside>

      {/* Pulse animation keyframes */}
      <style jsx>{`
        :global(.ask-claude-pulse) {
          animation: askClaudePulse 2.2s ease-out 3;
        }
        @keyframes askClaudePulse {
          0% {
            box-shadow: 0 10px 30px rgba(249, 115, 22, 0.35),
              0 2px 6px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(249, 115, 22, 0.7);
          }
          70% {
            box-shadow: 0 10px 30px rgba(249, 115, 22, 0.35),
              0 2px 6px rgba(0, 0, 0, 0.4),
              0 0 0 16px rgba(249, 115, 22, 0);
          }
          100% {
            box-shadow: 0 10px 30px rgba(249, 115, 22, 0.35),
              0 2px 6px rgba(0, 0, 0, 0.4),
              0 0 0 0 rgba(249, 115, 22, 0);
          }
        }
      `}</style>
    </>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{
          background: "rgba(249, 115, 22, 0.1)",
          border: "1px solid rgba(249, 115, 22, 0.25)",
        }}
      >
        <Sparkles className="w-5 h-5" style={{ color: "#F97316" }} />
      </div>
      <p
        className="text-sm font-semibold mb-1"
        style={{ color: "var(--text-primary, #F1F5F9)" }}
      >
        Ask a question about the dashboard
      </p>
      <p
        className="text-xs leading-relaxed max-w-[280px]"
        style={{ color: "var(--text-secondary, #94A3B8)" }}
      >
        Try &ldquo;What&rsquo;s driving the Texas enrollment decline?&rdquo; or
        &ldquo;Compare Florida and Texas redetermination pace.&rdquo;
      </p>
      <div
        className="mt-4 space-y-1.5 text-[11px]"
        style={{ color: "var(--text-muted, #475569)" }}
      >
        <div>Press ⌘K / Ctrl+K anywhere to open</div>
        <div>Press Esc to close</div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed"
        style={{
          background: isUser
            ? "rgba(249, 115, 22, 0.15)"
            : "var(--bg-deep, #0A0E1A)",
          border: isUser
            ? "1px solid rgba(249, 115, 22, 0.3)"
            : "1px solid var(--border-subtle, #1E293B)",
          color: "var(--text-primary, #F1F5F9)",
        }}
      >
        <p className="whitespace-pre-wrap">{msg.text}</p>
        {/* Action-card slot — reserved for the future hybrid model.
            When an assistant message carries msg.action, this is
            where a structured action card (filter, drill-down,
            highlight) would render alongside the prose. */}
        {msg.action && null}
      </div>
    </div>
  );
}
