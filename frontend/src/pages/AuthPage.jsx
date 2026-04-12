import React, { useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:8000';

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!isLogin && formData.password !== formData.confirm) {
      return setError('Passwords do not match');
    }
    if (!formData.username || !formData.password) {
      return setError('Username and password required');
    }

    setLoading(true);
    try {
      if (isLogin) {
        const res = await axios.post(`${API}/auth/login`, {
          username: formData.username,
          password: formData.password
        });
        onLogin(res.data.token, res.data.user);
      } else {
        const res = await axios.post(`${API}/auth/register`, {
          username: formData.username,
          password: formData.password
        });
        onLogin(res.data.token, res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body text-on-surface min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Architectural Texture Layer */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuBDgbyGF0LtFy_EJ42j_OJn4Z8knb3k9YHW6fI7JxWbc3LIhe3a2aR-Vvohs1yUODyyPtIXVr67umocmxMaP6nu2aJhMx982S3KuNhFdii8QiitPk3xjp1f0qmozI5TvH_VkfEZo2rH7-bANHuJ3wLZvDWcYf4EMsvQjPVucQr8VbhFFIG3gRUL9pMZgcdZhSB2Hby94A89PWUebirWZNIX4eMX-Eq0WRkqFhHnVeMg9aoqucLWRSHh2wwVMKFDNgjXy-3H6Jl8DRc)' }}></div>
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary-container/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-secondary-container/10 rounded-full blur-[100px]"></div>
      
      {/* Login Container */}
      <main className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_32px_64px_-12px_rgba(25,28,30,0.04)] relative z-10">
        
        {/* Branding & Visual Column */}
        <section className="hidden lg:flex flex-col justify-between p-12 bg-surface-container-low relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <span className="material-symbols-outlined text-primary text-4xl">architecture</span>
              <h1 className="font-headline text-2xl font-extrabold tracking-tight text-primary">InferaDoc</h1>
            </div>
            <div className="space-y-6 max-w-md">
              <h2 className="font-headline text-4xl font-bold leading-tight text-on-surface">The AI Document Intelligence Platform.</h2>
              <p className="text-on-surface-variant text-lg leading-relaxed">Experience a workspace that treats documentation as a conversational service. Sign in to access your dashboard and intelligent summaries.</p>
            </div>
          </div>

          
          {/* Decorative Abstract Architecture Element */}
          <div className="absolute right-[-20%] bottom-[-10%] w-[80%] h-[80%] opacity-10 rotate-12">
            <img className="w-full h-full object-cover rounded-xl grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJWiLFMSrmEjhChBGNwgQxWY8YciPMLv5BjVvr11uSclus2U4GKhzgSsv82geOCdOy4IcG03xQKMYjyr7yhTTKRfDLJEelrvoNp6jDXBx10swQsrQ71MJAo6IKtxcOk5HIgtI9UXZoQ0bcKB7XNYWz4U9anoh3hCVzKTsvcRxco8EVXf5a6h-HEVBPm-0-jwx4afk9TV8w57HyQHo-TvPlNMjOl-bOrgZ4rIYuCtBRdfVSjnH5PypbHe_2M9ZDmhs9iC6FV836wWQ" alt="Architecture" />
          </div>
        </section>

        {/* Form Column */}
        <section className="p-8 md:p-12 lg:p-20 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="lg:hidden flex items-center gap-2 mb-10">
              <span className="material-symbols-outlined text-primary text-3xl">architecture</span>
              <h1 className="font-headline text-xl font-extrabold tracking-tight text-primary">InferaDoc</h1>
            </div>
            
            <div className="mb-10">
              <h2 className="font-headline text-3xl font-bold text-on-surface mb-2">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
              <p className="text-on-surface-variant">{isLogin ? 'Please enter your credentials to continue your work.' : 'Join to access your document analytics.'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <button 
                type="button"
                onClick={() => setIsLogin(true)}
                className={`flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors duration-200 ${isLogin ? 'bg-primary text-white shadow-md' : 'bg-surface-container-highest text-on-surface hover:bg-surface-dim'}`}>
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => setIsLogin(false)}
                className={`flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors duration-200 ${!isLogin ? 'bg-primary text-white shadow-md' : 'bg-surface-container-highest text-on-surface hover:bg-surface-dim'}`}>
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-error-container text-on-error-container text-sm rounded-lg font-medium">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2" htmlFor="username">Username</label>
                <input 
                  id="username" 
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-xl text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary transition-all duration-200" 
                  placeholder="name@inferadoc.com" 
                  type="text" 
                  required
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-on-surface" htmlFor="password">Password</label>
                  {isLogin && <a className="text-sm font-semibold text-primary hover:text-primary-container transition-colors" href="#">Forgot Password?</a>}
                </div>
                <input 
                  id="password" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-xl text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary transition-all duration-200" 
                  placeholder="••••••••" 
                  type="password" 
                  required
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-semibold text-on-surface mb-2" htmlFor="confirm">Confirm Password</label>
                  <input 
                    id="confirm" 
                    value={formData.confirm}
                    onChange={e => setFormData({...formData, confirm: e.target.value})}
                    className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-xl text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary transition-all duration-200" 
                    placeholder="••••••••" 
                    type="password" 
                    required
                  />
                </div>
              )}
              
              {/* Checkbox removed per request */}
              
              <button disabled={loading} className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold rounded-xl shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2" type="submit">
                <span>{loading ? 'Processing...' : (isLogin ? 'Sign In to Dashboard' : 'Create Account')}</span>
                {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="absolute bottom-6 left-0 right-0 text-center z-10">
        <p className="text-xs text-on-surface-variant/60 font-medium">© 2024 InferaDoc Intelligence Systems. All rights reserved.</p>
      </footer>
    </div>
  );
}
