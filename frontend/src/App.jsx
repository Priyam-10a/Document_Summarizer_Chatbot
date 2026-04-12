import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ChatRouter from './pages/ChatRouter';
import './index.css';

const API = 'http://localhost:8000';

function setAxiosAuth(token) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthChecking(false);
      return;
    }
    setAxiosAuth(token);
    axios.get(`${API}/auth/me`)
      .then(res => {
        setUser(res.data);
      })
      .catch((err) => {
        console.error('Auth verification failed:', err);
        // ONLY log out if the backend explicitly rejects the token (401/403)
        // This prevents logging out just because the server restarted or wifi dropped
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
           localStorage.removeItem('token');
           setAxiosAuth(null);
           setUser(null);
        } else {
           // Fallback for network drops / backend reboots: parse user from token locally
           try {
             const payload = JSON.parse(atob(token.split('.')[1]));
             setUser({ id: payload.sub, username: payload.username });
           } catch(e) {}
        }
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  function handleLogin(token, userData) {
    localStorage.setItem('token', token);
    setAxiosAuth(token);
    setUser(userData);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    setAxiosAuth(null);
    setUser(null);
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard onLogout={handleLogout} user={user} />} />
        <Route path="/chat/:convId" element={<ChatRouter onLogout={handleLogout} user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
