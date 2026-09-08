import { Suspense } from 'react';
import { SearchResults } from '../../components/SearchResults';

export const metadata = {
  title: 'Search Results | AquaBid',
  description: 'Search for auctions on AquaBid',
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Search Results
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            Intelligent semantic and phonetic search powered by Elasticsearch.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="animate-pulse h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
