'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Mail, LogOut, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

export function Header() {
  const { dbUser, firebaseUser, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayName = dbUser?.name ?? firebaseUser?.displayName ?? 'User';
  const displayEmail = dbUser?.email ?? firebaseUser?.email ?? '';
  const avatarUrl = dbUser?.avatarUrl ?? firebaseUser?.photoURL ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Sign out failed');
    }
  };

  return (
    <header
      className="sticky top-0 z-50 glass"
      style={{ borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)' }}
          >
            <Mail className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-gradient">ReachInbox</span>
            <span className="text-xs ml-1.5 px-1.5 py-0.5 rounded-md font-medium"
              style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-light)', fontSize: '10px' }}>
              Scheduler
            </span>
          </div>
        </div>

        {/* User Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            id="user-menu-btn"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all hover:scale-[1.02]"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-indigo-500/30"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-none mb-0.5" style={{ color: 'var(--text-primary)' }}>
                {displayName}
              </p>
              <p className="text-xs leading-none" style={{ color: 'var(--text-muted)' }}>
                {displayEmail}
              </p>
            </div>
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform"
              style={{
                color: 'var(--text-muted)',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 glass-elevated rounded-xl overflow-hidden animate-fadein"
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            >
              <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{displayEmail}</p>
              </div>
              <div className="p-1">
                <button
                  id="sign-out-btn"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all hover:bg-red-500/10"
                  style={{ color: 'var(--danger)' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
