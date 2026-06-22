import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { KeyRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { ADMIN_EMAIL } from '../lib/server';

interface AdminAuthProps {
  open: boolean;
  onAuthenticated: () => void;
  onClose: () => void;
}

export default function AdminAuth({ open, onAuthenticated, onClose }: AdminAuthProps) {
  const [email, setEmail] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      setEmail('');
      onAuthenticated();
      toast.success(`Admin access granted. Welcome!`);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      toast.error('Access denied — email does not match the admin account.');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,23,42,0.68)', backdropFilter: 'blur(4px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.22, type: 'spring', stiffness: 340, damping: 26 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                  <KeyRound size={18} className="text-blue-600" />
                </div>
                <span className="text-xs font-black uppercase tracking-widest text-slate-800">
                  Admin Authentication
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Admin Email
              </label>
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder=""
                autoComplete="email"
                autoFocus
                className={[
                  'w-full px-4 py-3 rounded-xl border-[1.5px] text-slate-900 text-sm font-medium outline-none transition-all duration-150',
                  'focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10',
                  shake
                    ? 'border-red-500 ring-3 ring-red-500/10'
                    : 'border-slate-200',
                  shake ? 'shake' : '',
                ].join(' ')}
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmit}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-red-500 to-violet-600 text-white text-sm font-bold cursor-pointer hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
              >
                Authenticate
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 px-5 rounded-xl bg-white border-[1.5px] border-slate-200 text-slate-700 text-sm font-bold cursor-pointer hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
