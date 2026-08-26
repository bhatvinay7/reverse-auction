import { Package } from 'lucide-react';
import { NewForwardAuctionForm } from '../../../components/auction/NewForwardAuctionForm';
import { Sidebar } from '../../../components/Sidebar';
import { AdminGuard } from '../../../components/AdminGuard';

export default function NewForwardAuctionPage() {
  return (
    <AdminGuard><div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans selection:bg-blue-500/30">
      
      {/* Sidebar - fixed width */}
      <div className="fixed inset-y-0 left-0 z-50">
        <Sidebar />
      </div>

      {/* Main Content - dynamically padded based on sidebar state */}
      <div className="transition-all duration-300 md:pl-64">
        
        {/* Header */}
        <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
          <div className="px-6 md:px-10 h-20 flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
                Create Forward Auction
              </h1>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                List abandoned freight or physical products to sell to the highest bidder.
              </p>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            {/* Warning/Info Box */}
            <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-start gap-4">
              <Package className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-blue-900 dark:text-blue-100">Public Liquidation</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Forward auctions are open to the general public. Buyers will bid UP starting from your minimum reserve price. This is not for logistics loads, but for selling physical products.
                </p>
              </div>
            </div>

            <NewForwardAuctionForm />
          </div>
        </main>
      </div>
    </div></AdminGuard>
  );
}
