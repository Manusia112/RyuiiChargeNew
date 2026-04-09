export interface RecentTransaction {
  name: string;
  product: string;
  time: string;
}

export interface TransactionDetail {
  invoiceId: string;
  game: string;
  product: string;
  playerId: string;
  playerName?: string;
  price: number;
  paymentMethod: string;
  status: "pending" | "processing" | "success" | "failed";
  createdAt: string;
  steps: {
    label: string;
    status: "done" | "active" | "pending" | "failed";
    time?: string;
  }[];
}

export const recentTransactions: RecentTransaction[] = [
  { name: "shadam★★★", product: "86 Diamonds ML", time: "2 menit lalu" },
  { name: "Andi_Pro", product: "100 UC PUBG", time: "3 menit lalu" },
  { name: "galih★★★", product: "140 Diamonds FF", time: "5 menit lalu" },
  { name: "Budi_GG", product: "330 Genesis Crystals", time: "7 menit lalu" },
  { name: "ahmad★★★", product: "Pulsa 50.000", time: "8 menit lalu" },
  { name: "Nisa_ID", product: "Token PLN 100.000", time: "10 menit lalu" },
  { name: "shadam★★★", product: "514 Diamonds ML", time: "12 menit lalu" },
  { name: "Kevin_X", product: "475 VP Valorant", time: "14 menit lalu" },
  { name: "Rini_007", product: "3GB Data XL", time: "15 menit lalu" },
  { name: "galih★★★", product: "706 Diamonds ML", time: "18 menit lalu" },
  { name: "FajarID", product: "720 Diamonds FF", time: "20 menit lalu" },
  { name: "DianPro", product: "Token PLN 50.000", time: "22 menit lalu" },
];

export const mockTransactionLookup: Record<string, TransactionDetail> = {
  "INV-20240101-001": {
    invoiceId: "INV-20240101-001",
    game: "Mobile Legends: Bang Bang",
    product: "514 Diamonds",
    playerId: "123456789",
    playerName: "DarkSlayer_ID",
    price: 105000,
    paymentMethod: "QRIS",
    status: "success",
    createdAt: "2024-01-01 10:30:00",
    steps: [
      { label: "Pesanan Dibuat", status: "done", time: "10:30" },
      { label: "Pembayaran Diterima", status: "done", time: "10:31" },
      { label: "Diproses", status: "done", time: "10:31" },
      { label: "Selesai", status: "done", time: "10:32" },
    ],
  },
  "INV-20240102-002": {
    invoiceId: "INV-20240102-002",
    game: "Free Fire",
    product: "355 Diamonds",
    playerId: "111111",
    playerName: "FreeFireKing",
    price: 50000,
    paymentMethod: "OVO",
    status: "processing",
    createdAt: "2024-01-02 14:15:00",
    steps: [
      { label: "Pesanan Dibuat", status: "done", time: "14:15" },
      { label: "Pembayaran Diterima", status: "done", time: "14:16" },
      { label: "Diproses", status: "active" },
      { label: "Selesai", status: "pending" },
    ],
  },
  "INV-20240103-003": {
    invoiceId: "INV-20240103-003",
    game: "PUBG Mobile",
    product: "325 UC",
    playerId: "PUBG001",
    price: 75000,
    paymentMethod: "BCA Virtual Account",
    status: "pending",
    createdAt: "2024-01-03 09:00:00",
    steps: [
      { label: "Pesanan Dibuat", status: "done", time: "09:00" },
      { label: "Menunggu Pembayaran", status: "active" },
      { label: "Diproses", status: "pending" },
      { label: "Selesai", status: "pending" },
    ],
  },
};
