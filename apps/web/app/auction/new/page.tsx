import { Gavel } from 'lucide-react';
import { Sidebar } from '../../../components/Sidebar';
import { NewAuctionForm } from '../../../components/auction/NewAuctionForm';
import { AdminGuard } from '../../../components/AdminGuard';

export default function NewAuctionPage() {
  return (
    <AdminGuard><div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <main className="ml-0 px-4 pb-16 pt-24 md:ml-64 md:px-10 md:pt-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><Gavel size={14} /> New market event</div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950 dark:text-white md:text-4xl">Create an auction for anything</h1>
            <p className="mt-3 max-w-2xl text-zinc-500">Choose bid direction independently from the item or service. Logistics details are optional for both auction types.</p>
          </div>
          <NewAuctionForm />
        </div>
      </main>
    </div></AdminGuard>
  );
}
