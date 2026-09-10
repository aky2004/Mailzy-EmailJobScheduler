import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'mailZy – Email Scheduler',
  description: 'Production-grade email scheduler with BullMQ and Ethereal SMTP. Schedule, monitor, and track email campaigns at scale.',
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
                background: '#1a1a2e',
                color: '#e2e8f0',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '12px',
              },
              success: { iconTheme: { primary: '#6366f1', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
