import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'mailZy – Email Scheduler',
  description: 'Production-grade email scheduler with BullMQ and per-user SMTP. Schedule, monitor, and deliver email campaigns at scale.',
  keywords: ['email scheduler', 'BullMQ', 'mailZy', 'cold email', 'outreach'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#1E1E1E',
                color: '#F0F2F0',
                border: '1px solid #3E3F3E',
                borderRadius: '14px',
                fontSize: '13px',
                boxShadow: '0 12px 30px -8px rgba(0,0,0,0.7)',
              },
              success: { iconTheme: { primary: '#54C750', secondary: '#060C06' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#F0F2F0' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
