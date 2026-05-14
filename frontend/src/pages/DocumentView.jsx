import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const API = 'http://localhost:8000';

export default function DocumentView({ conv, messages, setMessages, convId }) {
  const [inputText, setInputText] = useState('');
  const [streamingMsg, setStreamingMsg] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMsg]);

  const sendQuery = async () => {
    const text = inputText.trim();
    if (!text || isReceiving) return;
    
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', content: text, created_at: new Date().toISOString() }]);
    setIsReceiving(true);
    setStreamingMsg('');

    try {
      const response = await fetch(`${API}/conversations/${convId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': axios.defaults.headers.common['Authorization']
        },
        body: JSON.stringify({ message: text })
      });

      if (!response.ok) throw new Error('API error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if(!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.chunk === '[DONE]') continue;
              fullReply += data.chunk;
            } catch(e) {}
          }
        }
        setStreamingMsg(fullReply);
      }

      setMessages(prev => [...prev, { role: 'agent', content: fullReply, created_at: new Date().toISOString() }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'agent', content: 'Connection lost. Please try again.', isError: true }]);
    } finally {
      setStreamingMsg('');
      setIsReceiving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  const hasDoc = Boolean(conv.doc_info);
  const docUrl = hasDoc ? `${API}/conversations/${convId}/file?token=${localStorage.getItem('token')}#toolbar=0&navpanes=0&scrollbar=0` : null;

  return (
    <main className="absolute top-16 left-0 lg:left-72 right-0 bottom-0 flex bg-surface overflow-hidden z-10 w-auto h-auto">
      {/* Left Side: Document Preview (65%) */}
      <section className="w-2/3 h-full overflow-y-auto p-12">
        <div className="max-w-4xl mx-auto h-full min-h-[800px]">
          {hasDoc ? (
            <div className="bg-surface-container-lowest rounded-xl shadow-sm h-full flex flex-col p-2">
               <div className="flex justify-between items-center px-4 py-2 bg-surface-container-low rounded-t-lg mb-2">
                 <span className="font-bold text-sm text-primary">{conv.title}</span>
                 <a href={docUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:text-primary-container">Open Native</a>
               </div>
               <iframe 
                  src={docUrl} 
                  className="w-full flex-1 rounded-b-lg border-0" 
                  title="Document Preview"
               ></iframe>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl p-10 shadow-sm min-h-[1000px] relative mt-10">
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-2 py-1 bg-primary-container/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded">Empty Knowledge Base</span>
                  <span className="text-on-surface-variant text-xs font-medium">Auto-generated</span>
                </div>
                <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight leading-tight mb-6">No document uploaded yet</h1>
                <p className="text-on-surface-variant font-medium text-lg leading-relaxed italic border-l-4 border-surface-tint/20 pl-6 mb-10">
                  Please upload a PDF or text file utilizing the drag and drop zone on the dashboard.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Right Side: AI Insights Chat (35%) */}
      <section className="w-1/3 h-full bg-surface-container-low border-l border-outline-variant/15 flex flex-col relative z-30">
        
        {/* Chat Header */}
        <div className="p-6 bg-surface-container-lowest/50 backdrop-blur-md flex items-center justify-between border-b border-outline-variant/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 editorial-gradient rounded-full flex items-center justify-center text-on-primary shadow-md">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
            </div>
            <div>
              <h4 className="text-sm font-headline font-bold">Insight Engine</h4>
              <span className="text-[10px] text-primary font-bold uppercase tracking-tighter">
                {hasDoc ? 'Connected to Document' : 'Awaiting Context'}
              </span>
            </div>
          </div>
          <button className="hidden material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">more_vert</button>
        </div>

        {/* Messages Container */}
        <div ref={scrollRef} className="flex-grow overflow-y-auto p-6 space-y-8 flex flex-col">
          {messages.length === 0 && !streamingMsg && (
            <div className="m-auto text-center p-6 bg-surface-container/50 rounded-xl">
               <span className="material-symbols-outlined text-4xl text-outline-variant mb-2">forum</span>
               <p className="text-sm text-on-surface-variant max-w-[200px] font-medium leading-relaxed">No messages yet. Ask InferaDoc a question about your sources.</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {timeStyle: 'short'});
            return (
              <div key={i} className={`max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}>
                {isUser ? (
                  <div className="bg-secondary-container text-on-secondary-container p-4 rounded-xl shadow-sm rounded-tr-sm">
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm relative group editorial-shadow border border-surface-container-high overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-8 editorial-gradient rounded-full -ml-0.5"></div>
                    <div className="text-sm leading-relaxed text-on-surface prose prose-sm prose-slate dark:prose-invert max-w-none overflow-x-auto">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                <div className={`mt-1 flex ${isUser ? 'justify-end mr-2' : 'justify-start ml-2 items-center gap-2'}`}>
                  <span className="text-[10px] text-on-surface-variant/60 font-medium">{timeStr}</span>
                  {!isUser && (
                    <>
                      <button className="material-symbols-outlined text-xs text-on-surface-variant hover:text-primary transition-colors">thumb_up</button>
                      <button className="material-symbols-outlined text-xs text-on-surface-variant hover:text-error transition-colors">thumb_down</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Streaming Response */}
          {isReceiving && streamingMsg && (
            <div className="max-w-[85%] self-start">
               <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm relative group editorial-shadow overflow-hidden border border-surface-container-high border-t-primary/50">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-surface-tint/5 rounded-full -translate-x-12 -translate-y-12 animate-pulse"></div>
                  <div className="text-sm leading-relaxed text-on-surface prose prose-sm relative z-10 max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {streamingMsg}
                      </ReactMarkdown>
                  </div>
               </div>
            </div>
          )}
          {isReceiving && !streamingMsg && (
             <div className="max-w-[85%] self-start">
               <div className="bg-surface-container-lowest p-5 rounded-xl flex items-center justify-center gap-1 shadow-sm">
                 <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
                 <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                 <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
               </div>
             </div>
          )}
        </div>

        {/* Chat Interaction Area */}
        <div className="p-6 bg-surface-container-highest/30 backdrop-blur-sm space-y-4 border-t border-outline-variant/10">
          <div className="relative group">
            <textarea 
              className="w-full bg-surface-container-lowest border border-surface-variant rounded-xl p-4 pr-12 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-sm resize-none placeholder:text-on-surface-variant/40" 
              placeholder="Ask anything about the document..." 
              rows="2"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              onClick={sendQuery}
              disabled={isReceiving || !inputText.trim()}
              className="absolute right-3 bottom-3 w-8 h-8 editorial-gradient text-on-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-transform disabled:opacity-50 disabled:grayscale"
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
          <p className="text-[10px] text-center text-on-surface-variant/50">Press Enter to send • / for commands</p>
        </div>
      </section>
    </main>
  );
}
