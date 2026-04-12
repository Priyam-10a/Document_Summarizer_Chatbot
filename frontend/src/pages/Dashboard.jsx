import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TopNav, SideNav } from '../components/Layout';

const API = 'http://localhost:8000';

export default function Dashboard({ onLogout, user }) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/conversations`);
      setConversations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadStep('Creating conversation...');
    try {
      // 1. Create a new conversation
      const convRes = await axios.post(`${API}/conversations`, { title: 'New Chat' });
      const convId = convRes.data.id;

      // 2. Upload document — consume SSE stream for progress
      setUploadStep('Uploading file...');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API}/conversations/${convId}/upload`, {
        method: 'POST',
        headers: { 'Authorization': axios.defaults.headers.common['Authorization'] },
        body: formData
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) throw new Error(data.error);
              if (data.message === 'Done') {
                // 3. Navigate to chat
                navigate(`/chat/${convId}`);
                return;
              }
              setUploadStep(data.message);
            } catch (e) {
              if (e.message && e.message !== 'Done') {
                console.error('Upload error:', e.message);
              }
            }
          }
        }
      }

      // Fallback navigation if stream ended without explicit "Done"
      navigate(`/chat/${convId}`);
    } catch (err) {
      console.error('Upload failed', err);
      setUploadStep('');
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  return (
    <div className="bg-surface font-body text-on-surface antialiased h-screen overflow-y-auto relative">
      <TopNav />
      <SideNav onLogout={onLogout} user={user} />

      <main className="pt-24 lg:pl-80 px-6 pb-24 min-h-full">
        <div className="max-w-4xl mx-auto flex flex-col gap-12">

          <div className="flex flex-col gap-8">
            <section>
              <h1 className="text-5xl font-extrabold font-headline text-on-surface tracking-tight mb-4">
                Distill Complexity into <span className="text-primary-container">Clarity.</span>
              </h1>
              <p className="text-lg text-on-surface-variant max-w-2xl leading-relaxed">
                InferaDoc transforms dense documents and recordings into polished conversational insights. Upload your sources to begin the synthesis.
              </p>
            </section>

            {/* File Upload Zone */}
            <section
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className={`bg-surface-container-high rounded-3xl p-12 transition-all group relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] border-none ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="absolute inset-0 bg-primary-fixed opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 bg-surface-container-lowest rounded-full flex items-center justify-center editorial-shadow">
                  {uploading ? (
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-primary text-4xl">cloud_upload</span>
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold font-headline text-on-surface mb-2">
                    {uploading ? 'Processing Analysis...' : 'Drag and drop your narrative'}
                  </h3>
                  {uploading && uploadStep && (
                    <p className="text-primary font-semibold text-sm animate-pulse mt-1">{uploadStep}</p>
                  )}
                  {!uploading && (
                    <p className="text-on-surface-variant">Support for PDF, TXT, DOCX, PPT, and MP3 archives</p>
                  )}
                </div>
                <div className="flex gap-4 mt-4">
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={e => handleFileUpload(e.target.files[0])}
                    accept=".pdf,.txt,.docx,.mp3,.wav,.mp4,.mpeg,audio/*,video/*"
                  />
                  <button onClick={() => fileInputRef.current?.click()} className="liquid-gradient text-on-primary px-8 py-3 rounded-md font-semibold text-sm shadow-lg active:scale-95 transition-transform">
                    Browse Files
                  </button>
                </div>
              </div>

              {/* Decorative Floating Icons */}
              <div className="absolute bottom-6 right-8 flex gap-3 opacity-30 grayscale hover:grayscale-0 transition-all duration-500 hidden md:flex">
                <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
                <span className="material-symbols-outlined text-3xl">audio_file</span>
                <span className="material-symbols-outlined text-3xl">article</span>
              </div>
            </section>

            {/* Recent Uploads (Bento Style) */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold font-headline text-on-surface">Recent Conversations</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-surface-container p-6 rounded-3xl animate-pulse flex gap-4 items-start">
                      <div className="w-12 h-12 bg-surface-container-high rounded-xl"></div>
                      <div className="flex-1 space-y-3 py-1">
                        <div className="h-4 bg-surface-container-high rounded w-3/4"></div>
                        <div className="h-3 bg-surface-container-high rounded w-1/2"></div>
                      </div>
                    </div>
                  ))
                ) : conversations.slice(0, 4).map(conv => {
                  const isAudio = conv.doc_info?.type === 'MP3' || conv.doc_info?.type === 'WAV';
                  return (
                    <div key={conv.id} onClick={() => navigate(`/chat/${conv.id}`)} className="bg-surface-container-lowest p-6 rounded-3xl editorial-shadow flex gap-4 items-start hover:translate-y-[-4px] transition-all cursor-pointer">
                      <div className={`${isAudio ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-secondary-container text-on-secondary-container'} p-3 rounded-xl flex items-center justify-center`}>
                        <span className="material-symbols-outlined">{isAudio ? 'mic' : 'description'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-on-surface truncate">{conv.title}</div>
                        <div className="text-xs text-on-surface-variant mt-1 truncate">
                          {new Date(conv.updated_at).toLocaleDateString()} • {conv.doc_info?.type || 'Empty'}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
                    </div>
                  );
                })}
                {!loading && conversations.length === 0 && (
                  <p className="text-sm text-on-surface-variant italic cursor-default">No recent intelligence found.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
