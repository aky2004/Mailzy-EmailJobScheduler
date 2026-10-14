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
    toast.error('Direct email sign-in is not configured. Use Google Sign-In.');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060C06]">
        <Loader2 className="w-8 h-8 animate-spin text-[#54C750]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-[#060C06] text-[#F0F2F0] relative overflow-hidden selection:bg-[#54C750]/30 selection:text-[#54C750]">
      {/* High-tech ambient background glow */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: 'radial-gradient(circle at 15% 20%, rgba(84, 199, 80, 0.12) 0%, transparent 45%), radial-gradient(circle at 85% 75%, rgba(84, 199, 80, 0.08) 0%, transparent 50%)'
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e1e1e0a_1px,transparent_1px),linear-gradient(to_bottom,#1e1e1e0a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <div className="flex w-full max-w-7xl mx-auto z-10 p-6 md:p-12 items-center justify-center lg:justify-between flex-col lg:flex-row gap-12">
        
        {/* Left Column: Hero Text */}
        <div className="flex-1 max-w-xl text-left hidden lg:block">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#54C750] text-[#060C06] font-black shadow-lg shadow-[#54C750]/25">
              <Mail className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-2xl font-black tracking-tight text-[#F0F2F0]">mailZy</span>
          </div>
          
          <h1 className="text-6xl font-black tracking-tight leading-[1.08] mb-6 text-[#F0F2F0]">
            Email<br/>
            Scheduling<br/>
            <span className="text-[#54C750] drop-shadow-[0_0_20px_rgba(84,199,80,0.35)]">Perfected.</span>
          </h1>
          
          <p className="text-lg text-[#A8ACA8] mb-12 max-w-lg leading-relaxed font-normal">
            High-performance email queue orchestration with BullMQ, Redis, and real per-user SMTP delivery in a sleek dark console.
          </p>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#1E1E1E]/80 border border-[#3E3F3E]/80 shadow-md">
              <div className="w-10 h-10 rounded-xl bg-[#54C750]/15 border border-[#54C750]/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#54C750]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#F0F2F0]">Ultra Fast</p>
                <p className="text-xs text-[#A8ACA8]">Redis-powered throughput</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#1E1E1E]/80 border border-[#3E3F3E]/80 shadow-md">
              <div className="w-10 h-10 rounded-xl bg-[#54C750]/15 border border-[#54C750]/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#54C750]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#F0F2F0]">AES-256 Vault</p>
                <p className="text-xs text-[#A8ACA8]">Encrypted SMTP secrets</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Login Card */}
        <div className="w-full max-w-md">
          <div className="bg-[#1E1E1E] rounded-[32px] p-8 md:p-10 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] border border-[#3E3F3E]">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-[#F0F2F0] mb-2 tracking-tight">Welcome Back</h2>
              <p className="text-sm text-[#A8ACA8]">Access your high-speed dispatch console</p>
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-5">
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-[#5B5B5B]" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-[#262626] border border-[#3E3F3E] rounded-xl text-[#F0F2F0] placeholder-[#5B5B5B] focus:outline-none focus:border-[#54C750] focus:ring-1 focus:ring-[#54C750] transition-all text-sm"
                    placeholder="Email address"
                  />
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-[#5B5B5B]" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-[#262626] border border-[#3E3F3E] rounded-xl text-[#F0F2F0] placeholder-[#5B5B5B] focus:outline-none focus:border-[#54C750] focus:ring-1 focus:ring-[#54C750] transition-all text-sm"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs py-1">
                <button 
                  type="button" 
                  onClick={() => setKeepSignedIn(!keepSignedIn)}
                  className="flex items-center gap-2 text-[#A8ACA8] hover:text-[#F0F2F0] transition-colors cursor-pointer"
                >
                  {keepSignedIn ? (
                    <CheckSquare className="w-4 h-4 text-[#54C750]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#5B5B5B]" />
                  )}
                  Remember me
                </button>
                <a href="#" className="font-semibold text-[#54C750] hover:text-[#46af42] transition-colors">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl shadow-lg shadow-[#54C750]/20 text-sm font-bold text-[#060C06] bg-[#54C750] hover:bg-[#46af42] focus:outline-none focus:ring-2 focus:ring-[#54C750] transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                Sign In to mailZy <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </form>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#3E3F3E]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wider">
                  <span className="bg-[#1E1E1E] px-3 text-[#5B5B5B] font-semibold">Or continue with</span>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleGoogleSignIn}
                  type="button"
                  className="flex w-full items-center justify-center gap-3 py-3.5 px-4 border border-[#3E3F3E] rounded-xl bg-[#282828] hover:bg-[#323232] text-[#F0F2F0] transition-colors focus:outline-none focus:ring-2 focus:ring-[#54C750] cursor-pointer"
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
                  <span className="text-sm font-semibold text-[#F0F2F0]">Continue with Google</span>
                </button>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-xs text-[#A8ACA8]">
                Protected with Firebase Auth & AES-256 GCM
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
