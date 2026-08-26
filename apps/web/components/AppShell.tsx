'use client';

import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import clsx from 'clsx';
import { RootState } from '../store/store';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const chromeFreeRoutes = ['/', '/login', '/signup', '/forgot-password', '/verify-email'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCollapsed = useSelector((state: RootState) => state.ui.isSidebarCollapsed);
  const hasAppChrome = !chromeFreeRoutes.includes(pathname);

  if (!hasAppChrome) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <Header />
      <Sidebar />
      <div
        className={clsx(
          'app-content min-h-dvh pt-16 transition-[padding] duration-300',
          isCollapsed ? 'md:pl-20' : 'md:pl-64',
        )}
      >
        {children}
      </div>
    </div>
  );
}
