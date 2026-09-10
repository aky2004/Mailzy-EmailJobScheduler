'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Zap, Shield, ArrowRight, Loader2, Lock, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { firebaseUser, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  useEffect(() => {
    if (!loading && firebaseUser) {
      router.replace('/dashboard');
    }
  }, [firebaseUser, loading, router]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error('Sign-in failed. Please try again.');
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    // This is just UI, the user will add real logic later or already has it elsewhere.
    // For now, we'll just show a toast since it's a UI update task.
    toast.error('Email sign-in is not configured yet. Use Google.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4fcf9]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-[#f4fcf9] text-[#1e293b]">
      {/* Background Gradient similar to mockup */}
      <div 
        className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 0% 0%, #ccfbf1 0%, transparent 40%), radial-gradient(circle at 100% 50%, #dcfce7 0%, transparent 40%)'
        }}
      />

      <div className="flex w-full max-w-7xl mx-auto z-10 p-6 md:p-12 items-center justify-center lg:justify-between flex-col lg:flex-row gap-12">
        
        {/* Left Column: Hero Text */}
        <div className="flex-1 max-w-xl text-left hidden lg:block">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <span className="text-2xl font-bold text-slate-800">mailZy</span>
          </div>
          
          <h1 className="text-6xl font-black tracking-tight leading-[1.1] mb-6 text-slate-900">
            Email<br/>
            Scheduling<br/>
            <span className="text-emerald-500">Perfected.</span>
          </h1>
          
          <p className="text-lg text-slate-600 mb-12 max-w-lg leading-relaxed">
            Experience high-performance email job management with BullMQ, Redis, and a sleek dashboard designed for modern engineering teams.
          </p>

          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                <Zap className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Ultra Fast</p>
                <p className="text-xs text-slate-500">Redis-powered throughput</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Job Safety</p>
                <p className="text-xs text-slate-500">Persistent queue recovery</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Login Card */}
        <div className="w-full max-w-md">
          <div className="bg-white rounded-[32px] p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h2>
              <p className="text-sm text-slate-500">Enter your credentials to access the console</p>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-6">
              <div className="space-y-5">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-transparent border-b border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors sm:text-sm"
                    placeholder="Email Address"
                  />
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-transparent border-b border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors sm:text-sm"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm py-2">
                <button 
                  type="button" 
                  onClick={() => setKeepSignedIn(!keepSignedIn)}
                  className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {keepSignedIn ? (
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300" />
                  )}
                  Keep me signed in
                </button>
                <a href="#" className="font-semibold text-emerald-500 hover:text-emerald-600 transition-colors">
                  Forgot?
                </a>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-emerald-500/25 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign In to mailZy <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                  <span className="bg-white px-4 text-slate-400 font-medium">Or continue with</span>
                </div>
              </div>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleGoogleSignIn}
                  type="button"
                  className="flex w-full items-center justify-center gap-3 py-3.5 px-4 border border-slate-200 rounded-2xl bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="text-sm font-semibold text-slate-700">Google</span>
                </button>
              </div>
            </div>

            <div className="mt-10 text-center">
              <p className="text-sm text-slate-500">
                Don&apos;t have an account?{' '}
                <a href="#" className="font-semibold text-emerald-500 hover:text-emerald-600 transition-colors">
                  Sign Up
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
