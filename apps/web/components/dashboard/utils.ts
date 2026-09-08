import { Car, Wrench, Laptop, Gem, Building2, Boxes, PackageOpen } from 'lucide-react';

export function categoryIcon(category: string) {
  const value = category.toLowerCase();
  if (value.includes("vehicle") || value.includes("motor")) return Car;
  if (value.includes("industrial") || value.includes("equipment")) return Wrench;
  if (value.includes("electronic") || value.includes("technology")) return Laptop;
  if (value.includes("collect") || value.includes("art")) return Gem;
  if (value.includes("service") || value.includes("contract")) return Building2;
  if (value.includes("logistic") || value.includes("freight")) return Boxes;
  return PackageOpen;
}

export function categoryTone(category: string) {
  const tones = [
    'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
    'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
    'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
    'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
    'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
  ];
  return tones[[...category].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length];
}
