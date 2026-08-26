/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  Car,
  ChevronRight,
  Clock3,
  Gem,
  Gavel,
  Laptop,
  PackageOpen,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { UserMenu } from "../components/UserMenu";
import type { Auction } from "../types/api";
import { useAuth } from "../contexts/AuthContext";

type AuctionPhase = "live" | "upcoming" | "ended";

function phaseOf(auction: Auction, now: number): AuctionPhase {
  const start = new Date(auction.auction_start_time).getTime();
  const end = new Date(auction.auction_end_time).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "ended";
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "ended";
}

function countdown(target: string, now: number) {
  const remaining = Math.max(0, new Date(target).getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

function money(value?: number) {
  if (value == null) return "Price on request";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function categoryName(auction: Auction) {
  return auction.item_category?.trim() || "General marketplace";
}

function categoryIcon(category: string) {
  const value = category.toLowerCase();
  if (value.includes("vehicle") || value.includes("motor")) return Car;
  if (value.includes("industrial") || value.includes("equipment"))
    return Wrench;
  if (value.includes("electronic") || value.includes("technology"))
    return Laptop;
  if (value.includes("collect") || value.includes("art")) return Gem;
  if (value.includes("service") || value.includes("contract")) return Building2;
  if (value.includes("logistic") || value.includes("freight")) return Boxes;
  return PackageOpen;
}

function categoryTone(category: string) {
  const tones = ['border-blue-200 bg-blue-50 text-blue-700', 'border-cyan-200 bg-cyan-50 text-cyan-700', 'border-violet-200 bg-violet-50 text-violet-700', 'border-emerald-200 bg-emerald-50 text-emerald-700', 'border-amber-200 bg-amber-50 text-amber-700', 'border-rose-200 bg-rose-50 text-rose-700'];
  return tones[[...category].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length];
}

function AuctionCard({
  auction,
  phase,
  now,
}: {
  auction: Auction;
  phase: AuctionPhase;
  now: number;
}) {
  const isLive = phase === "live";
  const category = categoryName(auction);
  const target = isLive ? auction.auction_end_time : auction.auction_start_time;
  const href = `/auction/${auction.id}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/30 to-cyan-50/50 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/70 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 dark:hover:shadow-black/30">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-zinc-800">
        {auction.media_urls?.[0] ? (
          <img
            src={auction.media_urls[0]}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800 to-blue-800 text-white">
            <Gavel className="h-12 w-12 opacity-70" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur-md ${
              isLive
                ? "border-red-300/50 bg-red-600/90 text-white"
                : "border-white/30 bg-slate-950/60 text-white"
            }`}
          >
            {isLive && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            )}
            {isLive ? "LIVE" : "UPCOMING"}
          </span>
          <span className="rounded-full border border-white/30 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 backdrop-blur-md">
            {auction.auction_type === "FORWARD" ? "Forward" : "Reverse"}
          </span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
          <span className="truncate text-xs font-bold uppercase tracking-[0.16em] text-white/80">
            {category}
          </span>
          <span className="shrink-0 rounded-lg bg-slate-950/70 px-2.5 py-1 font-mono text-sm font-bold backdrop-blur">
            {countdown(target, now)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-1 text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
          {auction.title}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-500 dark:text-zinc-400">
          {auction.description}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 dark:border-zinc-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {auction.auction_type === "FORWARD"
                ? "Opening bid"
                : "Price ceiling"}
            </p>
            <p className="mt-1 font-extrabold text-slate-900 dark:text-zinc-100">
              {money(auction.starting_price)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {isLive ? "Ends in" : "Starts in"}
            </p>
            <p
              className={`mt-1 font-mono text-sm font-extrabold ${isLive ? "text-red-600" : "text-blue-600 dark:text-blue-400"}`}
            >
              {countdown(target, now)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400">
            <Users className="h-4 w-4" />
            {auction.participants_count ?? 0} interested
          </span>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-extrabold text-blue-700 transition hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {isLive ? "Enter room" : "View details"}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function MarketplaceHome() {
  const { session } = useAuth();
  const [now, setNow] = useState(0);
  const [authToken, setAuthToken] = useState<string | null>();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    const anchor = Date.now();
    setNow(anchor);
    setAuthToken(localStorage.getItem("token"));
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: apiAuctions = [], isFetching } = useQuery<Auction[]>({
    queryKey: ["marketplace-auctions", authToken],
    enabled: Boolean(authToken),
    queryFn: async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const response = await fetch(`${apiUrl}/api/auction`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) throw new Error("The marketplace feed is unavailable");
      const payload = await response.json();
      return payload.auctions || [];
    },
    retry: 1,
  });

  const activeApiAuctions = useMemo(
    () =>
      apiAuctions.filter(
        (auction) => now > 0 && phaseOf(auction, now) !== "ended",
      ),
    [apiAuctions, now],
  );
  const sourceAuctions = activeApiAuctions;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    sourceAuctions.forEach((auction) => {
      const category = categoryName(auction);
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [sourceAuctions]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sourceAuctions.filter((auction) => {
      const category = categoryName(auction);
      const matchesCategory =
        selectedCategory === "All" || category === selectedCategory;
      const matchesSearch =
        !needle ||
        `${auction.title} ${auction.description} ${category}`
          .toLowerCase()
          .includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [search, selectedCategory, sourceAuctions]);

  const live = filtered.filter((auction) => phaseOf(auction, now) === "live");
  const upcoming = filtered.filter(
    (auction) => phaseOf(auction, now) === "upcoming",
  );

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950 selection:bg-blue-200 dark:bg-zinc-950 dark:text-white">
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white shadow-lg shadow-blue-700/20">
              <Gavel className="h-5 w-5" />
            </span>
            <span className="text-lg font-black tracking-tight">AquaBid</span>
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <a
              href="#marketplace"
              className="text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white"
            >
              Marketplace
            </a>
            <a
              href="#categories"
              className="text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white"
            >
              Categories
            </a>
            <Link
              href="/dashboard"
              className="text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white"
            >
              Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-950 text-white dark:border-zinc-800">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,#2563eb_0,transparent_35%),radial-gradient(circle_at_85%_75%,#0d9488_0,transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1fr_0.78fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-200">
              <Sparkles className="h-3.5 w-3.5" />
              One market · two auction directions
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Discover the next opportunity before the clock runs out.
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-slate-300 sm:text-lg">
              Buy assets in forward auctions or source goods and services
              through reverse auctions—all with a live, auditable bidding
              experience.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={authToken ? "/dashboard" : "/login"}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 font-extrabold text-white shadow-xl shadow-blue-900/30 transition hover:bg-blue-500"
              >
                Browse live auctions <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={!authToken ? "/signup" : session?.role === "CUSTOMER" ? "/sell/new" : session?.role === "ADMIN" ? "/admin" : "/dashboard"}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 font-extrabold text-white transition hover:bg-white/20"
              >
                {session?.role === "CARRIER" ? "Bidder dashboard" : session?.role === "ADMIN" ? "Review listings" : "Sell an item"} <PackageOpen className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="col-span-2 rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">
                  Market activity
                </span>
                <Zap className="h-5 w-5 text-amber-300" />
              </div>
              <div className="mt-5 grid grid-cols-3 divide-x divide-white/10">
                <div>
                  <p className="text-3xl font-black">{live.length}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Live now
                  </p>
                </div>
                <div className="pl-4">
                  <p className="text-3xl font-black">{upcoming.length}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Upcoming
                  </p>
                </div>
                <div className="pl-4">
                  <p className="text-3xl font-black">{categories.length}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Categories
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-md">
              <TrendingUp className="h-6 w-6 text-emerald-300" />
              <p className="mt-5 text-sm font-extrabold">Forward</p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                Highest valid bid wins
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-md">
              <TrendingDown className="h-6 w-6 text-cyan-300" />
              <p className="mt-5 text-sm font-extrabold">Reverse</p>
              <p className="mt-1 text-xs font-medium text-slate-400">
                Lowest valid bid wins
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="marketplace" className="border-b border-slate-200 bg-[#f7f8fb] py-16 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase text-blue-700 dark:text-blue-400">Marketplace</p><h2 className="mt-2 text-3xl font-black">Live and upcoming auctions</h2><p className="mt-2 text-slate-500 dark:text-zinc-400">Search products, services, assets, and contracts across both auction directions.</p></div><label className="relative block w-full lg:max-w-sm"><span className="sr-only">Search auctions</span><Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search auctions" className="h-12 w-full border border-slate-300 bg-white pl-11 pr-4 font-medium outline-none focus:border-blue-600 dark:border-zinc-700 dark:bg-zinc-900" /></label></div>
          <div id="categories" className="mt-7 flex gap-3 overflow-x-auto pb-3"><button onClick={() => setSelectedCategory('All')} className={`flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-bold ${selectedCategory === 'All' ? 'border-blue-700 bg-blue-700 text-white' : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 shadow-sm dark:bg-zinc-800"><PackageOpen size={22} /></span>All categories</button>{categories.map(([category,count]) => { const Icon=categoryIcon(category); return <button key={category} onClick={() => setSelectedCategory(category)} className={`flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 ${selectedCategory === category ? 'border-blue-700 bg-blue-700 text-white' : `${categoryTone(category)} dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200`}`}><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 shadow-sm dark:bg-zinc-800"><Icon size={22} strokeWidth={2.2} /></span>{category}<span className="opacity-60">{count}</span></button>; })}</div>
          {isFetching && <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading auctions">{[1,2,3].map(value => <div key={value} className="h-96 animate-pulse bg-slate-200 dark:bg-zinc-800" />)}</div>}
          {!isFetching && filtered.length > 0 && <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(auction => <AuctionCard key={auction.id} auction={auction} phase={phaseOf(auction,now)} now={now} />)}</div>}
          {!isFetching && authToken && filtered.length === 0 && <div className="mt-8 border border-slate-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900"><PackageOpen className="mx-auto text-slate-400" /><h3 className="mt-4 font-black">No matching auctions</h3><p className="mt-2 text-sm text-slate-500">Try another search or category.</p></div>}
          {!authToken && <div className="mt-8 border border-blue-200 bg-blue-50 p-8 text-center dark:border-blue-900 dark:bg-blue-950/20"><h3 className="font-black">Sign in to browse the live catalogue</h3><p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">Registration status and participant access are personalized to your account.</p><Link href="/login" className="mt-5 inline-flex bg-blue-700 px-5 py-3 font-bold text-white">Sign in</Link></div>}
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl"><p className="text-xs font-black uppercase text-blue-700 dark:text-blue-400">Built for both sides of the market</p><h2 className="mt-3 text-3xl font-black">One marketplace, two focused workflows</h2><p className="mt-3 leading-7 text-slate-500 dark:text-zinc-400">Sellers stay in control of their listing while administrators handle quality review and scheduling. Bidders get a clean path from discovery to a verified live bid.</p></div>
          <div className="mt-10 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 dark:border-zinc-800 dark:bg-zinc-800 lg:grid-cols-2">
            <div className="bg-white p-7 dark:bg-zinc-950"><Building2 className="text-emerald-600" /><h3 className="mt-5 text-xl font-black">For sellers</h3><ol className="mt-5 space-y-4 text-sm text-slate-600 dark:text-zinc-300"><li><strong className="mr-2 text-emerald-700">01</strong>Submit product details, pricing, availability, photos, and videos.</li><li><strong className="mr-2 text-emerald-700">02</strong>Respond to clear review feedback and track every status change.</li><li><strong className="mr-2 text-emerald-700">03</strong>Follow the scheduled auction through completion from a dedicated dashboard.</li></ol><Link href={authToken ? "/seller/dashboard" : "/signup"} className="mt-7 inline-flex items-center gap-2 font-black text-emerald-700">Open seller workspace <ArrowRight size={16} /></Link></div>
            <div className="bg-white p-7 dark:bg-zinc-950"><Gavel className="text-blue-700" /><h3 className="mt-5 text-xl font-black">For bidders</h3><ol className="mt-5 space-y-4 text-sm text-slate-600 dark:text-zinc-300"><li><strong className="mr-2 text-blue-700">01</strong>Compare upcoming forward and reverse auctions by category.</li><li><strong className="mr-2 text-blue-700">02</strong>Register early, or unregister any time before the auction starts.</li><li><strong className="mr-2 text-blue-700">03</strong>Bid from a live console with valid-price guidance and durable audit history.</li></ol><Link href={authToken ? "/dashboard" : "/signup"} className="mt-7 inline-flex items-center gap-2 font-black text-blue-700">Browse bidder marketplace <ArrowRight size={16} /></Link></div>
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <ShieldCheck className="h-9 w-9 text-blue-700 dark:text-blue-400" />
            <h3 className="mt-5 font-black">Verified participation</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-zinc-400">
              Role-aware access and participant checks protect seller reviews,
              registrations, and live auction rooms.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <Zap className="h-9 w-9 text-amber-600 dark:text-blue-400" />
            <h3 className="mt-5 font-black">Every bid in order</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-zinc-400">
              Bids are processed sequentially within each auction, giving every
              participant a consistent price and result.
            </p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <Clock3 className="h-9 w-9 text-violet-600 dark:text-blue-400" />
            <h3 className="mt-5 font-black">Auditable outcomes</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-zinc-400">
              Accepted and rejected attempts are retained so authorized users
              can review how an auction reached its final outcome.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2 font-black">
            <Gavel className="h-5 w-5 text-blue-700 dark:text-blue-400" />{" "}
            AquaBid
          </div>
          <p className="text-xs font-semibold text-slate-400">
            Forward and reverse auctions for modern markets.
          </p>
        </div>
      </footer>
    </main>
  );
}
