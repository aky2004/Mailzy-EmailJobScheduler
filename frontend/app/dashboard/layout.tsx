'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !firebaseUser) {
      router.replace('/login');
    }
  }, [firebaseUser, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4fcf9]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) return null;

  return (
    <div className="h-screen w-full bg-white overflow-hidden">
      {children}
    </div>
  );
}
