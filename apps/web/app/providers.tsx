'use client';

import { Provider } from 'react-redux';
import { store } from '../store/store';
import { ThemeProvider } from 'next-themes';
import { SocketProvider } from '../contexts/SocketContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <SocketProvider>
          {children}
        </SocketProvider>
      </ThemeProvider>
    </Provider>
  );
}
