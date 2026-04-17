'use client';

import './globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';

const AUTH_ROUTES = ['/login', '/register'];

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {!isAuthRoute && <Navbar />}
      <main className={!isAuthRoute ? 'pt-16' : ''}>{children}</main>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            retry: 1,
          },
        },
      })
  );

  // Ensure Zustand persisted state is loaded
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <html lang="en" className="dark">
        <body className="bg-gray-950" />
      </html>
    );
  }

  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Unified Profile Explorer</title>
        <meta
          name="description"
          content="Dynamic Salesforce Data Cloud profile explorer and visual data model editor"
        />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AppContent>{children}</AppContent>
          <ToastContainer />
        </QueryClientProvider>
      </body>
    </html>
  );
}

// ============================================================
// Simple toast notification system
// ============================================================

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

let toastListeners: Array<(toasts: ToastMessage[]) => void> = [];
let toastQueue: ToastMessage[] = [];

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = Math.random().toString(36).slice(2);
  const toast: ToastMessage = { id, type, message };
  toastQueue = [...toastQueue, toast];
  toastListeners.forEach((fn) => fn([...toastQueue]));

  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    toastListeners.forEach((fn) => fn([...toastQueue]));
  }, 4000);
}

function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (t: ToastMessage[]) => setToasts([...t]);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-enter px-4 py-3 rounded-lg shadow-xl text-sm font-medium pointer-events-auto max-w-sm ${
            toast.type === 'success'
              ? 'bg-green-900 border border-green-700 text-green-100'
              : toast.type === 'error'
              ? 'bg-red-900 border border-red-700 text-red-100'
              : 'bg-gray-800 border border-gray-600 text-gray-100'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
