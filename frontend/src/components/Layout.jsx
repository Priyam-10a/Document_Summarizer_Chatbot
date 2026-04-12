import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

export function TopNav() {
  return (
    <header className="bg-slate-50 dark:bg-slate-900 flex justify-between items-center w-full px-6 h-16 fixed top-0 z-50 transition-colors border-b border-transparent">
      <Link to="/" className="text-xl font-bold tracking-tight text-blue-950 dark:text-blue-50 font-headline flex items-center gap-2">
         <span className="material-symbols-outlined text-primary">architecture</span>
         InferaDoc
      </Link>
    </header>
  );
}

function ConvItem({ conv, active, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title);
  const [isSaving, setIsSaving] = useState(false);

  async function commitRename() {
    if (draft.trim() && draft !== conv.title) {
      setIsSaving(true);
      await onRename(conv.id, draft.trim());
      setIsSaving(false);
    }
    setEditing(false);
  }

  return (
    <div className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all ${active ? 'bg-slate-200/80 dark:bg-slate-800/80 border-l-4 border-primary' : 'border-l-4 border-transparent'}`} onClick={() => !editing && onSelect(conv.id)}>
      <div className="flex items-center gap-3 w-full overflow-hidden">
        <span className="material-symbols-outlined text-base text-slate-500">chat_bubble</span>
        {editing ? (
          <input
            className="w-full bg-slate-50 border border-outline/30 text-sm text-slate-800 px-2 py-1 rounded font-manrope outline-none focus:border-primary/50"
            value={draft}
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div className="flex-1 min-w-0 pr-2">
             <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{conv.title}</div>
             <div className="text-[10px] text-slate-400">{new Date(conv.updated_at).toLocaleDateString()}</div>
          </div>
        )}
      </div>
      <div className="hidden group-hover:flex items-center gap-1 min-w-[48px] justify-end" onClick={e => e.stopPropagation()}>
        {isSaving ? (
          <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
        ) : editing ? (
          <button className="text-slate-400 hover:text-primary transition-colors" onClick={commitRename}><span className="material-symbols-outlined text-[16px]">check</span></button>
        ) : (
          <button className="text-slate-400 hover:text-primary transition-colors" onClick={() => setEditing(true)}><span className="material-symbols-outlined text-[16px]">edit</span></button>
        )}
        {!isSaving && !editing && (
          <button className="text-slate-400 hover:text-error transition-colors" onClick={() => onDelete(conv.id)}>
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        )}
      </div>
    </div>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, isDeleting }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-2xl max-w-sm w-full border border-outline-variant/30 transform transition-all scale-100">
        <h3 className="text-xl font-bold font-headline mb-2 text-on-surface">Delete Conversation?</h3>
        <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">This action cannot be undone. The document and chat history will be permanently deleted.</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={isDeleting} className="px-5 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting} className="px-5 py-2 text-sm font-semibold text-white bg-error hover:bg-error/90 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-w-[90px]">
            {isDeleting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SideNav({ onLogout, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [location.pathname]); // Refresh list when navigating to sync state

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:8000/conversations`);
      setConversations(res.data);
    } catch (err) { console.error(err); } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if(!deleteTarget) return;
    try {
      setIsDeleting(true);
      await axios.delete(`http://localhost:8000/conversations/${deleteTarget}`);
      setConversations(prev => prev.filter(c => c.id !== deleteTarget));
      if(location.pathname === `/chat/${deleteTarget}`) navigate('/');
      setDeleteTarget(null);
    } catch (err) { console.error(err); } finally {
      setIsDeleting(false);
    }
  };

  const renameConv = async (id, title) => {
    try {
      await axios.put(`http://localhost:8000/conversations/${id}`, { title });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    } catch (err) { console.error(err); }
  };

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-full w-72 flex-col pt-24 pb-6 gap-4 bg-slate-100 dark:bg-slate-950 border-r border-transparent z-40">
      <div className="px-8 pb-2 flex-shrink-0">
        <div className="text-lg font-black text-blue-900 dark:text-blue-100 font-headline">Workspace</div>
        <div className="text-xs text-on-surface-variant font-medium tracking-widest uppercase">AI Document Summarizer</div>
      </div>
      
      <button onClick={() => navigate('/')} className="mx-6 liquid-gradient text-on-primary py-3 rounded-md font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 flex-shrink-0">
        <span className="material-symbols-outlined text-sm">add</span>
        New Upload
      </button>
      
      <div className="px-8 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 flex-shrink-0">
        Recent Chats
      </div>

      <nav className="flex-1 overflow-y-auto px-4 flex flex-col gap-1 pb-4 mt-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
             <div key={i} className="flex items-center gap-3 px-3 py-4 w-full animate-pulse">
               <div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
               <div className="flex-1 space-y-2">
                 <div className="w-3/4 h-3 bg-slate-200 dark:bg-slate-800 rounded"></div>
                 <div className="w-1/2 h-2 bg-slate-200 dark:bg-slate-800 rounded"></div>
               </div>
             </div>
          ))
        ) : (
          conversations.map(conv => (
            <ConvItem 
              key={conv.id} 
              conv={conv} 
              active={location.pathname === `/chat/${conv.id}`} 
              onSelect={(id) => navigate(`/chat/${id}`)}
              onDelete={id => setDeleteTarget(id)}
              onRename={renameConv}
            />
          ))
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-4 text-xs font-medium text-slate-400 italic mt-2">No historical queries found.</p>
        )}
      </nav>
      
      <div className="mt-auto px-4 flex flex-col gap-1 flex-shrink-0 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="px-4 py-2 flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
           <span className="material-symbols-outlined text-primary">person</span> {user?.username || 'User'}
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-3 text-slate-600 dark:text-slate-400 px-4 py-3 hover:bg-error/10 hover:text-error rounded-xl transition-all">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-manrope text-sm font-semibold">Sign Out</span>
        </button>
      </div>

      <DeleteConfirmModal 
        isOpen={!!deleteTarget} 
        onClose={() => setDeleteTarget(null)} 
        onConfirm={confirmDelete} 
        isDeleting={isDeleting} 
      />
    </aside>
  );
}
