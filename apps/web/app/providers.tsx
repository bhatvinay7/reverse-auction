'use client';

import { Provider } from 'react-redux';
import { store } from '../store/store';
import { ThemeProvider } from 'next-themes';
import { SocketProvider } from '../contexts/SocketContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { AuthGuard } from '../components/AuthGuard';
import { AuthProvider } from '../contexts/AuthContext';

export function Providers({ children, serverUserId }: { children: React.ReactNode, serverUserId?: string }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthProvider>
            <SocketProvider serverUserId={serverUserId}>
              <AuthGuard>{children}</AuthGuard>
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </Provider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
