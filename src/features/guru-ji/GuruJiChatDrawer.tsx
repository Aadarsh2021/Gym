import React, { useState } from 'react';
import { Sparkles, Send, User, Bot, X } from 'lucide-react';
import { aiService } from '@/services/ai.service';
import { CoachResponse } from '@/types/ai.types';

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  disclaimer?: string;
}

interface GuruJiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const GuruJiChatDrawer: React.FC<GuruJiChatDrawerProps> = ({
  isOpen,
  onClose,
  onNavigateTab: _onNavigateTab,
}) => {
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: 'Namaste! Main aapka Guru Ji AI fitness coach hoon. Aaj ke workout, nutrition, form, ya consistency ke baare me kuch bhi poochein!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const quickPrompts = [
    'Aaj ka workout kaisa plan karein?',
    'Vegetarian protein target kaise pura karein?',
    'Bench press me elbow position kaisi honi chahiye?',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: MessageItem = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: query.trim().slice(0, 500),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res: CoachResponse = await aiService.askGuruJi(userMsg.content);
      const assistantMsg: MessageItem = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: res.message,
        disclaimer: res.disclaimer,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: 'bot-err-' + Date.now(),
          role: 'assistant',
          content: 'Guru Ji is temporarily reviewing training notes. Please focus on executing your workout with good form!',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: 'var(--space-4)',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ padding: '8px', background: 'var(--accent-primary-muted)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Guru Ji — AI Fitness Coach</h3>
              <small style={{ color: 'var(--text-secondary)' }}>Context-Aware Assistant</small>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Chat History Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={18} color="var(--accent-primary)" />
                </div>
              )}

              <div>
                <div
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-input)',
                    color: msg.role === 'user' ? 'var(--text-inverse)' : 'var(--text-primary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                    fontSize: '0.95rem',
                    lineHeight: 1.5,
                  }}
                >
                  {msg.content}
                </div>

                {msg.disclaimer && (
                  <small style={{ display: 'block', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {msg.disclaimer}
                  </small>
                )}
              </div>

              {msg.role === 'user' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={18} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <span className="spinner" style={{ width: '16px', height: '16px' }} />
              Guru Ji is typing advice...
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ padding: '0 var(--space-4) var(--space-2)', display: 'flex', gap: 'var(--space-2)', overflowX: 'auto' }}>
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              className="btn btn-secondary btn-sm"
              onClick={() => handleSend(p)}
              style={{ fontSize: '0.78rem', whiteSpace: 'nowrap', padding: '4px 8px' }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div style={{ padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
          <form
            onSubmit={e => { e.preventDefault(); handleSend(); }}
            style={{ display: 'flex', gap: 'var(--space-2)' }}
          >
            <input
              type="text"
              className="input"
              placeholder="Ask Guru Ji anything (e.g. Aaj kya train karein?)..."
              value={input}
              maxLength={500}
              onChange={e => setInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
              <Send size={18} />
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span>Guru Ji provides reference fitness guidance. Not a doctor.</span>
            <span>{input.length}/500</span>
          </div>
        </div>
      </div>
    </div>
  );
};
