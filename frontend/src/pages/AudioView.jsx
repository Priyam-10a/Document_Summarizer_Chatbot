import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import WaveSurfer from 'wavesurfer.js';

const API = 'http://localhost:8000';

export default function AudioView({ conv, messages, setMessages, convId }) {
  const [inputText, setInputText] = useState('');
  const [streamingMsg, setStreamingMsg] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDecoding, setIsDecoding] = useState(true);
  const [loadingTranscript, setLoadingTranscript] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('Loading transcript...');
  
  const scrollRef = useRef(null);
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);

  const docUrl = conv.doc_info ? `${API}/conversations/${convId}/file?token=${localStorage.getItem('token')}` : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMsg]);

  // Fetch Transcript
  useEffect(() => {
    const getTranscription = async () => {
      try {
        setLoadingTranscript(true);
        const res = await axios.get(`${API}/conversations/${convId}/transcript`);
        setTranscript(res.data.transcript || 'No transcript found.');
      } catch(e) {
        setTranscript('Unable to load transcript. Make sure you are viewing a freshly processed MP3.');
      } finally {
        setLoadingTranscript(false);
      }
    };
    getTranscription();
  }, [convId]);

  // WaveSurfer initialization
  useEffect(() => {
    if (!waveformRef.current || !docUrl) return;

    // Reset UI state cleanly
    setIsDecoding(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);

    let ws = null;
    let blobUrl = null;
    let cancelled = false;

    const init = async () => {
      try {
        // 1. Fetch the audio file ourselves to bypass WaveSurfer's internal fetch (which fails on CORS)
        const resp = await fetch(docUrl);
        if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
        const blob = await resp.blob();
        if (cancelled) return;

        blobUrl = URL.createObjectURL(blob);

        // 2. Small delay so React has painted the container
        await new Promise(r => setTimeout(r, 100));
        if (cancelled) return;

        if (wavesurferRef.current) wavesurferRef.current.destroy();

        ws = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#B0C4DE',
          progressColor: '#0A56D9',
          cursorColor: '#0A56D9',
          barWidth: 3,
          barGap: 2,
          barRadius: 2,
          height: 70,
          normalize: true,
          url: blobUrl
        });

        ws.on('ready', () => {
          setDuration(ws.getDuration());
          setIsDecoding(false);
        });

        ws.on('error', (err) => {
          console.error('WaveSurfer error:', err);
          setIsDecoding(false);
        });

        ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()));
        ws.on('interaction', () => setCurrentTime(ws.getCurrentTime()));
        ws.on('finish', () => setIsPlaying(false));

        wavesurferRef.current = ws;
      } catch (err) {
        console.error('Audio load error:', err);
        setIsDecoding(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (ws) ws.destroy();
      else if (wavesurferRef.current) wavesurferRef.current.destroy();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [docUrl]);

  const togglePlay = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
    setIsPlaying(wavesurferRef.current.isPlaying());
  };

  const skip = (amount) => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.skip(amount);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const sendQuery = async (overrideText = null) => {
    const text = (overrideText || inputText).trim();
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

  return (
    <main className="absolute top-16 left-0 lg:left-72 right-0 bottom-0 flex gap-8 p-8 bg-surface-container-lowest overflow-hidden z-10 w-auto h-auto">
      
      {/* Central Media & Transcript Panel */}
      <div className="flex-1 flex flex-col pt-2 border border-surface-container rounded-2xl bg-surface shadow-sm overflow-hidden min-w-0">
        
        {/* Header Section */}
        <header className="px-8 pt-6 pb-4 flex-shrink-0 border-b border-surface-variant/30 flex justify-between items-start">
          <div className="min-w-0 pr-4">
            <h1 className="text-2xl font-headline font-extrabold text-on-surface truncate">{conv.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-on-surface-variant font-medium text-sm">
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">audio_file</span> {conv.doc_info?.type || 'AUDIO'}</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> {formatTime(duration)}</span>
              <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_today</span> {new Date(conv.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
          <a href={docUrl} download className="bg-surface-container-lowest text-on-surface border border-outline-variant px-4 py-2 rounded-lg font-semibold text-sm hover:bg-surface-container transition-colors shadow-sm flex items-center gap-2 flex-shrink-0">
            <span className="material-symbols-outlined text-base">download</span> Export
          </a>
        </header>

        {/* Audio Player Core natively generated by WaveSurfer */}
        <div className="bg-surface-container-low px-8 py-6 flex-shrink-0 border-b border-surface-variant/50 relative">
          {/* Waveform Wrapper */}
          <div className="w-full h-[70px] relative">
            {isDecoding && (
               <div className="absolute inset-0 flex items-center justify-center bg-surface-container-low z-20 animate-pulse rounded-lg bg-opacity-90">
                 <div className="flex items-center gap-3 text-primary font-bold text-sm">
                   <div className="w-5 h-5 border-[3px] border-primary border-t-transparent rounded-full animate-spin"></div>
                   Decoding Audio Layers...
                 </div>
               </div>
            )}
            <div className="w-full h-full cursor-pointer relative z-10" ref={waveformRef}></div>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-6">
              <button onClick={() => skip(-10)} className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined" style={{fontSize: '28px'}}>replay_10</span>
              </button>
              <button onClick={togglePlay} className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-md">
                <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>{isPlaying ? 'pause' : 'play_arrow'}</span>
              </button>
              <button onClick={() => skip(10)} className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined" style={{fontSize: '28px'}}>forward_10</span>
              </button>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-bold font-mono text-on-surface-variant">
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              <select 
                onChange={(e) => {if(wavesurferRef.current) wavesurferRef.current.setPlaybackRate(parseFloat(e.target.value))}}
                className="bg-surface-container border-none text-xs font-bold rounded-lg py-1 px-2 focus:ring-0 cursor-pointer ml-4"
              >
                <option value="1.0">1.0x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="2.0">2.0x</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transcript Section - Hard bounded so it natively scrolls locally */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 bg-surface-container-lowest border-b border-surface-variant/30 text-xs font-bold text-on-surface-variant tracking-widest uppercase flex items-center justify-between">
            <span>Raw Transcript</span>
            {loadingTranscript && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] animate-pulse">Fetching from Database...</span>}
          </div>
          <div className="flex-1 overflow-y-auto bg-surface-container-lowest p-8 text-on-surface leading-loose text-base pb-16 prose max-w-none relative">
             {loadingTranscript ? (
               <div className="space-y-4 animate-pulse pt-2">
                 <div className="h-4 bg-surface-variant/20 rounded-md w-full"></div>
                 <div className="h-4 bg-surface-variant/20 rounded-md w-[90%]"></div>
                 <div className="h-4 bg-surface-variant/20 rounded-md w-[95%]"></div>
                 <div className="h-4 bg-surface-variant/20 rounded-md w-[80%]"></div>
                 <div className="h-4 bg-surface-variant/20 rounded-md w-full mt-8"></div>
                 <div className="h-4 bg-surface-variant/20 rounded-md w-[85%]"></div>
                 <div className="h-4 bg-surface-variant/20 rounded-md w-[92%]"></div>
               </div>
             ) : (
               <ReactMarkdown 
                 remarkPlugins={[remarkGfm, remarkMath]} 
                 rehypePlugins={[rehypeKatex]}
               >
                 {transcript}
               </ReactMarkdown>
             )}
          </div>
        </div>
      </div>

      {/* Right Side Panel: AI Insights */}
      <aside className="w-[380px] flex flex-col flex-shrink-0 relative z-30 border border-surface-container rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        
        <div className="p-5 border-b border-surface-variant/30 bg-surface-container-low/40 flex justify-between items-center">
          <h2 className="font-headline font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
            AI Insights
          </h2>
          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight border border-primary/20">RAG Enabled</span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 p-5 space-y-6 overflow-y-auto flex flex-col bg-slate-50/50">
          
          {messages.length === 0 && !streamingMsg && (
            <div className="space-y-3 mb-6 mt-auto">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter ml-1">Ask the Document</p>
              <button onClick={() => sendQuery("Summarize the main discussion points.")} className="w-full text-left p-3 text-sm bg-white rounded-xl border border-slate-200 hover:border-primary/50 transition-colors shadow-sm text-slate-700">
                  "Summarize the main discussion points."
              </button>
              <button onClick={() => sendQuery("List the action items mentioned.")} className="w-full text-left p-3 text-sm bg-white rounded-xl border border-slate-200 hover:border-primary/50 transition-colors shadow-sm text-slate-700">
                  "List the action items mentioned."
              </button>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            return (
              <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`${isUser ? 'bg-primary text-white rounded-br-sm' : 'bg-white rounded-bl-sm border border-slate-200 shadow-sm'} p-3 rounded-2xl text-sm max-w-[85%] prose prose-sm max-w-none`}>
                   {isUser ? <p className="whitespace-pre-wrap leading-tight">{msg.content}</p> : <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>}
                </div>
              </div>
            );
          })}

          {/* Streaming Indicator */}
          {isReceiving && streamingMsg && (
            <div className="flex flex-col items-start w-full">
               <div className="relative bg-white p-3 rounded-2xl rounded-bl-sm text-sm max-w-[85%] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="absolute left-0 top-0 w-1 h-full bg-primary/40 animate-pulse"></div>
                  <div className="prose prose-sm pl-2 max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{streamingMsg}</ReactMarkdown></div>
               </div>
            </div>
          )}
          {isReceiving && !streamingMsg && (
             <div className="flex flex-col items-start w-full">
               <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center gap-1.5">
                 <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
                 <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                 <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
               </div>
             </div>
          )}
        </div>

        {/* Input Box */}
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="relative flex items-center group">
            <input 
              className="w-full bg-slate-100 border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
              placeholder="Ask anything..." 
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendQuery()}
              disabled={isReceiving}
            />
            <button onClick={() => sendQuery()} disabled={isReceiving || !inputText.trim()} className="absolute right-2 p-1.5 bg-primary text-white rounded-lg disabled:opacity-50 hover:scale-105 shadow-md active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>
      </aside>
    </main>
  );
}
