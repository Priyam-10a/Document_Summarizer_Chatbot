import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import DocumentView from './DocumentView';
import AudioView from './AudioView';
import { SideNav, TopNav } from '../components/Layout';

const API = 'http://localhost:8000';

export default function ChatRouter({ onLogout, user }) {
  const { convId } = useParams();
  const navigate = useNavigate();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/conversations/${convId}`)
      .then(res => {
        setConv(res.data.conversation);
        setMessages(res.data.messages || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        navigate('/'); // Redirect to dashboard if not found or unauthorized
      });
  }, [convId, navigate]);

  if (loading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const audioTypes = ['MP3', 'WAV', 'M4A', 'MPEG', 'MPGA', 'MP4', 'OGG', 'FLAC', 'WEBM'];
  const isAudio = conv.doc_info && audioTypes.includes(conv.doc_info.type);

  // Props to pass down
  const childProps = {
    conv,
    setConv,
    messages,
    setMessages,
    convId
  };

  return (
    <div className="bg-surface font-body text-on-surface antialiased h-screen overflow-hidden flex flex-col">
      <TopNav />
      <SideNav onLogout={onLogout} user={user} />
      
      {isAudio ? (
        <AudioView {...childProps} />
      ) : (
        <DocumentView {...childProps} />
      )}
    </div>
  );
}
