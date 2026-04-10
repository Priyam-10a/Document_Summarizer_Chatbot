import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  UploadCloud, FileText, Send, User, Bot, 
  Trash2, FileJson, List, Hash, AlignLeft
} from 'lucide-react';
import './index.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [docLoaded, setDocLoaded] = useState(false);
  const [docInfo, setDocInfo] = useState({});
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Check status on load
    axios.get(`${API_BASE}/status`)
      .then(res => {
        setDocLoaded(res.data.doc_loaded);
        if (res.data.doc_loaded) {
          setDocInfo(res.data.doc_info);
        }
      })
      .catch(err => console.error("Error checking status:", err));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDocInfo(res.data.doc_info);
      setDocLoaded(true);
      setMessages([]); // Clear chat on new document
    } catch (error) {
      console.error("Upload error:", error);
      alert("Error uploading document: " + (error.response?.data?.detail || error.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (customMessage = null) => {
    const messageToSend = customMessage || inputText;
    if (!messageToSend.trim()) return;

    // Add user message
    const newMessages = [...messages, { role: 'user', content: messageToSend }];
    setMessages(newMessages);
    if (!customMessage) setInputText('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_BASE}/chat`, { message: messageToSend });
      setMessages([...newMessages, { role: 'agent', content: res.data.response }]);
    } catch (error) {
      setMessages([...newMessages, { 
        role: 'agent', 
        content: `⚠️ Error: ${error.response?.data?.detail || error.message}` 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar glass-panel">
        <div className="brand">
          <Bot size={32} color="var(--accent-primary)" />
          InferaDoc
        </div>
        <div className="subtitle">AI Document Assistant</div>

        <div className="section-title">Upload Document</div>
        <div 
          className={`upload-zone ${isProcessing ? 'processing' : ''}`}
          onClick={() => !isProcessing && fileInputRef.current.click()}
        >
          <UploadCloud className="upload-icon" size={36} />
          <div className="upload-text">
            {isProcessing ? 'Processing Document...' : 'Click or Drag to Upload'}
          </div>
          <div className="upload-subtext">Supports PDF, DOCX, TXT</div>
          <input 
            type="file" 
            ref={fileInputRef}
            className="file-input-hidden" 
            accept=".pdf,.docx,.txt"
            onChange={handleFileUpload}
            disabled={isProcessing}
          />
        </div>

        {docLoaded && (
          <>
            <div className="doc-card">
              <FileJson className="doc-icon" size={24} />
              <div className="doc-details">
                <div className="doc-name" title={docInfo.name}>{docInfo.name}</div>
                <div className="doc-meta">{docInfo.type} • {docInfo.size}</div>
              </div>
            </div>

            <div className="section-title">Quick Actions</div>
            <div className="quick-actions">
              <button className="action-btn" onClick={() => handleSendMessage("Give me a full summary")} disabled={isTyping}>
                <List size={18} color="var(--accent-primary)"/> Give me a full summary
              </button>
              <button className="action-btn" onClick={() => handleSendMessage("What are the key points?")} disabled={isTyping}>
                <Hash size={18} color="#0ea5e9"/> What are the key points?
              </button>
              <button className="action-btn" onClick={() => handleSendMessage("What is the main topic?")} disabled={isTyping}>
                <FileText size={18} color="#10b981"/> What is the main topic?
              </button>
              <button className="action-btn" onClick={() => handleSendMessage("List the important details")} disabled={isTyping}>
                <AlignLeft size={18} color="#f59e0b"/> List the important details
              </button>
            </div>
          </>
        )}

        <button 
          className="btn btn-secondary mt-auto" 
          onClick={clearChat}
          style={{ marginTop: 'auto' }}
        >
          <Trash2 size={18} /> Clear Chat
        </button>
      </aside>

      {/* Main Chat Area */}
      <main className="main-area glass-panel">
        {!docLoaded ? (
          <div className="welcome-screen">
            <Bot className="welcome-icon" size={80} />
            <div className="welcome-title">Upload a document to begin</div>
            <p>Ask questions, get summaries, and explore your content.</p>
          </div>
        ) : messages.length === 0 ? (
           <div className="welcome-screen">
             <div className="welcome-title text-accent">📄 {docInfo.name} is ready</div>
             <p>Ask anything about the document</p>
           </div>
        ) : (
          <div className="chat-container">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role === 'user' ? 'msg-user' : 'msg-agent'}`}>
                <div className="msg-label">
                  {msg.role === 'user' ? (
                    <>You <User size={14} /></>
                  ) : (
                    <><Bot size={14} /> InferaDoc</>
                  )}
                </div>
                <div className="msg-bubble">{msg.content}</div>
              </div>
            ))}
            {isTyping && (
              <div className="message msg-agent">
                <div className="msg-label"><Bot size={14} /> InferaDoc</div>
                <div className="msg-bubble typing-indicator">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input Area */}
        <div className="input-area">
          <div className="input-container">
            <textarea
              className="chat-input"
              placeholder={docLoaded ? "Ask something about the document..." : "Upload a document first..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={!docLoaded || isTyping}
              rows={1}
            />
            <button 
              className="send-btn" 
              onClick={() => handleSendMessage()}
              disabled={!docLoaded || isTyping || !inputText.trim()}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
