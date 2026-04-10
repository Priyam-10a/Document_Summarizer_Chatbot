import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, Send, UploadCloud, FileText,
  Bot, User, MessageSquare, ChevronRight, X,
  Pencil, Check
} from 'lucide-react';
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

function ConvItem({ conv, active, onSelect, onDelete, onRename }) {
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
      onClick={() => !editing && onSelect(conv.id)}
    >
      <MessageSquare size={15} className="conv-icon" />

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
          ? <button className="icon-btn" onClick={commitRename}><Check size={13} /></button>
          : <button className="icon-btn" onClick={() => setEditing(true)}><Pencil size={13} /></button>
        }
        <button className="icon-btn danger" onClick={() => onDelete(conv.id)}><Trash2 size={13} /></button>
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
        {msg.content}
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
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/conversations`)
      .then(r => setConversations(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Conversation ops ───────────────────────────────────────────────────────
  async function newConversation() {
    const r = await axios.post(`${API}/conversations`, { title: 'New Chat' });
    setConversations(prev => [r.data, ...prev]);
    selectConversation(r.data.id, r.data);
  }

  async function selectConversation(id, convObj = null) {
    if (id === activeId) return;
    setActiveId(id);
    setMessages([]);
    setDocInfo(null);

    const r = await axios.get(`${API}/conversations/${id}`);
    setMessages(r.data.messages);
    setDocInfo(r.data.conversation.doc_info || null);

    // Refresh list to get updated timestamps/titles
    const list = await axios.get(`${API}/conversations`);
    setConversations(list.data);
  }

  async function deleteConversation(id) {
    await axios.delete(`${API}/conversations/${id}`);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
      setDocInfo(null);
    }
  }

  async function renameConversation(id, title) {
    await axios.patch(`${API}/conversations/${id}`, { title });
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, title } : c)
    );
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
    setMessages(prev => [...prev, optimistic]);
    setInputText('');
    setIsTyping(true);

    try {
      const r = await axios.post(`${API}/conversations/${activeId}/chat`, { message: text });
      setMessages(prev => [...prev, { role: 'agent', content: r.data.response, id: Date.now() + 1 }]);
      // Refresh list for updated title/timestamp
      const list = await axios.get(`${API}/conversations`);
      setConversations(list.data);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'agent',
        content: `⚠️ Error: ${err.response?.data?.detail || err.message}`,
        id: Date.now() + 1
      }]);
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
          <span className="brand-text">InferaDoc</span>
          <button className="icon-btn" onClick={() => setSidebarOpen(v => !v)} title="Toggle sidebar">
            <ChevronRight size={18} className={`chevron ${sidebarOpen ? 'rotated' : ''}`} />
          </button>
        </div>

        <button className="new-chat-btn" onClick={newConversation}>
          <Plus size={16} /> New Chat
        </button>

        <div className="conv-list">
          {conversations.length === 0 && (
            <p className="empty-hint">No conversations yet.<br />Click "New Chat" to start.</p>
          )}
          {conversations.map(conv => (
            <ConvItem
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              onSelect={selectConversation}
              onDelete={deleteConversation}
              onRename={renameConversation}
            />
          ))}
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
                disabled={isUploading}
              >
                <UploadCloud size={15} />
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
          {!activeId ? (
            <div className="splash">
              <Bot size={56} className="splash-icon" />
              <h2>Welcome to InferaDoc</h2>
              <p>Create a new conversation and upload a document to begin.</p>
              <button className="splash-btn" onClick={newConversation}>
                <Plus size={16} /> New Chat
              </button>
            </div>
          ) : messages.length === 0 && !isTyping ? (
            <div className="splash">
              {docInfo ? (
                <>
                  <FileText size={48} className="splash-icon ready" />
                  <h2>Document Ready</h2>
                  <p><strong>{docInfo.name}</strong> — {docInfo.chunks} chunks indexed.</p>
                  <div className="quick-prompts">
                    {['Give me a full summary', 'What are the key points?', 'What is the main topic?'].map(p => (
                      <button key={p} className="prompt-chip" onClick={() => sendMessage(p)}>{p}</button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <UploadCloud size={48} className="splash-icon" />
                  <h2>Upload a Document</h2>
                  <p>Click "Upload Doc" in the top-right to get started.</p>
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
                placeholder={docInfo ? 'Ask anything about the document…' : 'Upload a document first…'}
                value={inputText}
                onInput={onInput}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={isTyping}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={() => sendMessage()}
                disabled={isTyping || !inputText.trim()}
              >
                <Send size={18} />
              </button>
            </div>
            <p className="input-hint">Enter to send · Shift+Enter for newline</p>
          </div>
        )}
      </main>
    </div>
  );
}
