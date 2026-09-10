export default function AuctionLoading() {
  return (
    <div
      className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-zinc-950 sm:p-6"
      role="status"
      aria-label="Loading auction"
    >
      <div className="mx-auto max-w-[1400px] animate-pulse space-y-6">
        <div className="flex h-16 items-center justify-between border border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-8 w-28 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="h-48 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-48 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className="h-64 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="min-h-[470px] rounded-2xl bg-zinc-200 dark:bg-zinc-800 lg:col-span-4" />
        </div>
      </div>
      <span className="sr-only">Loading auction details…</span>
    </div>
  );
}
