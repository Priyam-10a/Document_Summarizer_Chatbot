import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, Send, UploadCloud, FileText,
  Bot, User, MessageSquare, ChevronRight,
  Pencil, Check, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './index.css';

const API = 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ConvItem({ conv, active, onSelect, onDelete, onRename, isActionLoading }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function commitRename() {
    if (draft.trim() && draft !== conv.title) onRename(conv.id, draft.trim());
    setEditing(false);
  }

  return (
    <div
      className={`conv-item ${active ? 'conv-active' : ''}`}
      onClick={() => !editing && !isActionLoading && onSelect(conv.id)}
    >
      {isActionLoading ? (
        <Loader2 size={15} className="conv-icon spin-icon" />
      ) : (
        <MessageSquare size={15} className="conv-icon" />
      )}

      <div className="conv-body">
        {editing ? (
          <input
            ref={inputRef}
            className="conv-rename-input"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            onClick={e => e.stopPropagation()}
            disabled={isActionLoading}
          />
        ) : (
          <>
            <span className="conv-title">{conv.title}</span>
            <span className="conv-time">{timeAgo(conv.updated_at)}</span>
          </>
        )}
      </div>

      <div className="conv-actions" onClick={e => e.stopPropagation()}>
        {editing
          ? <button className="icon-btn" onClick={commitRename} disabled={isActionLoading}><Check size={13} /></button>
          : <button className="icon-btn" onClick={() => setEditing(true)} disabled={isActionLoading}><Pencil size={13} /></button>
        }
        <button className="icon-btn danger" onClick={() => onDelete(conv.id)} disabled={isActionLoading}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="msg agent-msg">
      <div className="msg-avatar agent-avatar"><Bot size={16} /></div>
      <div className="msg-bubble typing-bubble">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`msg ${isUser ? 'user-msg' : 'agent-msg'}`}>
      {!isUser && (
        <div className="msg-avatar agent-avatar"><Bot size={16} /></div>
      )}
      <div className={`msg-bubble ${isUser ? 'user-bubble' : 'agent-bubble'}`}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkMath]} 
          rehypePlugins={[rehypeKatex]}
        >
          {msg.content}
        </ReactMarkdown>
      </div>
      {isUser && (
        <div className="msg-avatar user-avatar"><User size={16} /></div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [docInfo, setDocInfo] = useState(null);
  const [inputText, setInputText] = useState('');
  
  // Loading states
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isSwitchingChat, setIsSwitchingChat] = useState(false);
  const [loadingActions, setLoadingActions] = useState(new Set()); // set of conv_ids currently deleting/renaming

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const setActionLoading = (id, isLoading) => {
    setLoadingActions(prev => {
      const next = new Set(prev);
      if (isLoading) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    axios.get(`${API}/conversations`)
      .then(r => setConversations(r.data))
      .catch(console.error)
      .finally(() => setIsAppLoading(false));
  }, []);

  useEffect(() => {
    if (bottomRef.current) {
      const chatArea = bottomRef.current.closest('.chat-area');
      if (chatArea) {
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
      } else {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [messages, isTyping]);

  // ── Conversation ops ───────────────────────────────────────────────────────
  async function newConversation() {
    setIsSwitchingChat(true);
    try {
      const r = await axios.post(`${API}/conversations`, { title: 'New Chat' });
      setConversations(prev => [r.data, ...prev]);
      setActiveId(r.data.id);
      setMessages([]);
      setDocInfo(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSwitchingChat(false);
    }
  }

  async function selectConversation(id) {
    if (id === activeId || isSwitchingChat) return;
    setIsSwitchingChat(true);
    setActiveId(id);
    setMessages([]);
    setDocInfo(null);

    try {
      const r = await axios.get(`${API}/conversations/${id}`);
      setMessages(r.data.messages || []);
      setDocInfo(r.data.conversation.doc_info || null);

      // Refresh list to get updated timestamps/titles if backend mutated them
      const list = await axios.get(`${API}/conversations`);
      setConversations(list.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSwitchingChat(false);
    }
  }

  async function deleteConversation(id) {
    setActionLoading(id, true);
    try {
      await axios.delete(`${API}/conversations/${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
        setDocInfo(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(id, false);
    }
  }

  async function renameConversation(id, title) {
    setActionLoading(id, true);
    try {
      await axios.patch(`${API}/conversations/${id}`, { title });
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, title } : c)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(id, false);
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    setIsUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await axios.post(`${API}/conversations/${activeId}/upload`, form);
      setDocInfo(r.data.doc_info);
      // Refresh conversation list (title may have changed)
      const list = await axios.get(`${API}/conversations`);
      setConversations(list.data);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  async function sendMessage(custom = null) {
    const text = (custom || inputText).trim();
    if (!text || !activeId) return;

    const optimistic = { role: 'user', content: text, id: Date.now() };
    const agentMsgId = Date.now() + 1;
    
    setMessages(prev => [...prev, optimistic]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API}/conversations/${activeId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let done = false;
      let buffer = '';
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop(); // keep the last incomplete chunk in the buffer
          
          for (const part of parts) {
            if (part.startsWith('data: ')) {
              const dataStr = part.slice(6);
              const data = JSON.parse(dataStr);
              if (data.chunk === '[DONE]') {
                 const list = await axios.get(`${API}/conversations`);
                 setConversations(list.data);
                 break;
              }
              
              setIsTyping(false); // Stop typing spinner once stream arrives
              setMessages(prev => {
                if (!prev.some(m => m.id === agentMsgId)) {
                  return [...prev, { role: 'agent', content: data.chunk, id: agentMsgId }];
                }
                return prev.map(m => m.id === agentMsgId ? { ...m, content: m.content + data.chunk } : m);
              });
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        if (!prev.some(m => m.id === agentMsgId)) {
          return [...prev, { role: 'agent', content: `⚠️ Error: ${err.message}`, id: agentMsgId }];
        }
        return prev.map(m => m.id === agentMsgId ? { ...m, content: m.content + `\n\n⚠️ Error: ${err.message}` } : m);
      });
    } finally {
      setIsTyping(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Auto-grow textarea
  function onInput(e) {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  }

  const activeConv = conversations.find(c => c.id === activeId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="shell">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header">
          <span className="brand-text">INFERADOC</span>
          <button className="icon-btn" onClick={() => setSidebarOpen(v => !v)} title="Toggle sidebar">
            <ChevronRight size={18} className={`chevron ${sidebarOpen ? 'rotated' : ''}`} />
          </button>
        </div>

        <button className="new-chat-btn" onClick={newConversation} disabled={isAppLoading || isSwitchingChat}>
          {isSwitchingChat && !activeId ? <Loader2 size={16} className="spin-icon"/> : <Plus size={16} />} 
          New Chat
        </button>

        <div className="conv-list">
          {isAppLoading ? (
             <div className="loader-box">
                <Loader2 size={24} className="spin-icon" />
             </div>
          ) : conversations.length === 0 ? (
            <p className="empty-hint">No conversations yet.<br />Click "New Chat" to start.</p>
          ) : (
            conversations.map(conv => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeId}
                isActionLoading={loadingActions.has(conv.id)}
                onSelect={selectConversation}
                onDelete={deleteConversation}
                onRename={renameConversation}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="main">

        {/* Top bar */}
        <header className="topbar">
          {!sidebarOpen && (
            <button className="icon-btn" onClick={() => setSidebarOpen(true)}>
              <ChevronRight size={18} />
            </button>
          )}
          <span className="topbar-title">
            {activeConv ? activeConv.title : 'InferaDoc — AI Document Assistant'}
          </span>

          {activeId && (
            <div className="topbar-actions">
              {docInfo ? (
                <div className="doc-pill" title={docInfo.name}>
                  <FileText size={13} />
                  <span>{docInfo.name}</span>
                  <span className="doc-type">{docInfo.type}</span>
                </div>
              ) : null}
              <button
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSwitchingChat}
              >
                {isUploading ? <Loader2 size={15} className="spin-icon"/> : <UploadCloud size={15} />}
                {isUploading ? 'Processing…' : docInfo ? 'Replace Doc' : 'Upload Doc'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                style={{ display: 'none' }}
                onChange={handleUpload}
              />
            </div>
          )}
        </header>

        {/* Chat area */}
        <div className="chat-area">
          {isSwitchingChat ? (
            <div className="splash loader-splash">
               <Loader2 size={48} className="spin-icon splash-icon" />
               <h2>Loading Chat...</h2>
            </div>
          ) : !activeId ? (
            <div className="splash">
              <div className="logo-glow">
                <Bot size={56} className="splash-icon" />
              </div>
              <h2>Welcome to InferaDoc</h2>
              <p>Experience document intelligence with stunning speed and precision.</p>
              <button className="splash-btn" onClick={newConversation}>
                <Plus size={16} /> Start Exploring
              </button>
            </div>
          ) : messages.length === 0 && !isTyping ? (
            <div className="splash">
              {docInfo ? (
                <>
                  <div className="logo-glow success">
                    <FileText size={48} className="splash-icon ready" />
                  </div>
                  <h2>Document Active</h2>
                  <p><strong>{docInfo.name}</strong> — {docInfo.chunks} chunks mapped in hyperspace.</p>
                  <div className="quick-prompts">
                    {['Give me a full summary', 'Extract the key points', 'Identify the main arguments'].map(p => (
                      <button key={p} className="prompt-chip" onClick={() => sendMessage(p)}>{p}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="logo-glow">
                    <UploadCloud size={48} className="splash-icon" />
                  </div>
                  <h2>Upload Payload</h2>
                  <p>Drop a document or click the top-right button to initiate analysis.</p>
                </>
              )}
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => <Message key={msg.id || i} msg={msg} />)}
              {isTyping && <TypingDots />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {activeId && (
          <div className="input-bar">
            <div className="input-wrap">
              <textarea
                ref={textareaRef}
                className="chat-input"
                placeholder={docInfo ? 'Query the document...' : 'Awaiting document upload before querying...'}
                value={inputText}
                onInput={onInput}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={isTyping || isSwitchingChat}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={() => sendMessage()}
                disabled={isTyping || !inputText.trim() || isSwitchingChat}
              >
                {isTyping ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
              </button>
            </div>
            <p className="input-hint">Enter to dispatch · Shift+Enter for newline</p>
          </div>
        )}
      </main>
    </div>
  );
}
