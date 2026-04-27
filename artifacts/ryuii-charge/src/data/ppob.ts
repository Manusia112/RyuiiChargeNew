export interface PpobProduct {
  id: string;
  category: "pulsa" | "pln" | "data";
  label: string;
  provider?: string;
  price: number;
  description: string;
}

export const ppobProducts: PpobProduct[] = [
  { id: "pulsa-10k", category: "pulsa", label: "Pulsa 10.000", provider: "All Operator", price: 11500, description: "Pulsa reguler semua operator" },
  { id: "pulsa-25k", category: "pulsa", label: "Pulsa 25.000", provider: "All Operator", price: 26500, description: "Pulsa reguler semua operator" },
  { id: "pulsa-50k", category: "pulsa", label: "Pulsa 50.000", provider: "All Operator", price: 51500, description: "Pulsa reguler semua operator" },
  { id: "pulsa-100k", category: "pulsa", label: "Pulsa 100.000", provider: "All Operator", price: 101500, description: "Pulsa reguler semua operator" },
  { id: "pln-20k", category: "pln", label: "Token PLN 20.000", price: 22500, description: "Token listrik PLN prabayar" },
  { id: "pln-50k", category: "pln", label: "Token PLN 50.000", price: 52500, description: "Token listrik PLN prabayar" },
  { id: "pln-100k", category: "pln", label: "Token PLN 100.000", price: 102500, description: "Token listrik PLN prabayar" },
  { id: "pln-200k", category: "pln", label: "Token PLN 200.000", price: 202500, description: "Token listrik PLN prabayar" },
  { id: "data-1gb", category: "data", label: "Paket Data 1GB", provider: "All Operator", price: 15000, description: "Paket data 30 hari" },
  { id: "data-3gb", category: "data", label: "Paket Data 3GB", provider: "All Operator", price: 30000, description: "Paket data 30 hari" },
  { id: "data-5gb", category: "data", label: "Paket Data 5GB", provider: "All Operator", price: 45000, description: "Paket data 30 hari" },
  { id: "data-10gb", category: "data", label: "Paket Data 10GB", provider: "All Operator", price: 75000, description: "Paket data 30 hari" },
];
