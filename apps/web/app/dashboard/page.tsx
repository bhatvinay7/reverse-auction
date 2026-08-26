'use client';

import { Sidebar } from '../../components/Sidebar';
import { Dashboard } from '../../components/Dashboard';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

export default function Home() {
  const isCollapsed = useSelector((state: RootState) => state.ui.isSidebarCollapsed);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - fixed width */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className={`flex-1 ml-0 transition-all duration-300 pt-20 md:pt-8 p-8 ${isCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <Dashboard />
      </main>
    </div>
  );
}
