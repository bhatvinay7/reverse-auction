import { Sidebar } from '../../components/Sidebar';
import { Dashboard } from '../../components/Dashboard';

export default function Home() {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar - fixed width */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 ml-0 md:ml-64 pt-20 md:pt-8 p-8">
        <Dashboard />
      </main>
    </div>
  );
}
