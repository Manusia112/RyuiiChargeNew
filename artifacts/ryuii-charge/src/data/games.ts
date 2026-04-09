export interface GameDenomination {
  id: string;
  label: string;
  amount: number;
  price: number;
  originalPrice?: number;
  sku?: string;
}

export interface Game {
  slug: string;
  name: string;
  category: "mobile" | "pc" | "voucher";
  image: string;
  banner: string;
  description: string;
  idLabel: string;
  serverLabel?: string;
  denominations: GameDenomination[];
  mockNicknames: Record<string, string>;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export const categories: Category[] = [
  { id: "mobile", label: "Game Mobile", icon: "📱", description: "ML, FF, PUBG & more" },
  { id: "pc", label: "Game PC", icon: "💻", description: "Steam, Valorant, Genshin" },
  { id: "voucher", label: "Voucher Digital", icon: "🎫", description: "Netflix, Spotify, dll" },
];

export const games: Game[] = [
  {
    slug: "mobile-legends",
    name: "Mobile Legends: Bang Bang",
    category: "mobile",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&h=200&fit=crop",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=300&fit=crop",
    description: "Top up Diamond Mobile Legends dengan harga termurah dan proses otomatis!",
    idLabel: "User ID",
    serverLabel: "Zone ID",
    denominations: [
      { id: "ml-86", label: "86 Diamonds", amount: 86, price: 19000, originalPrice: 22000 },
      { id: "ml-172", label: "172 Diamonds", amount: 172, price: 37000, originalPrice: 42000 },
      { id: "ml-257", label: "257 Diamonds", amount: 257, price: 55000, originalPrice: 62000 },
      { id: "ml-344", label: "344 Diamonds", amount: 344, price: 72000, originalPrice: 82000 },
      { id: "ml-514", label: "514 Diamonds", amount: 514, price: 105000, originalPrice: 120000 },
      { id: "ml-706", label: "706 Diamonds", amount: 706, price: 142000, originalPrice: 160000 },
      { id: "ml-1412", label: "1412 Diamonds", amount: 1412, price: 280000 },
      { id: "ml-2195", label: "2195 Diamonds", amount: 2195, price: 430000 },
    ],
    mockNicknames: {
      "123456789": "DarkSlayer_ID",
      "987654321": "ProGamer★★★",
      "111222333": "ShadowKnight",
      "444555666": "NexaBoss99",
    },
  },
  {
    slug: "free-fire",
    name: "Free Fire",
    category: "mobile",
    image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=200&h=200&fit=crop",
    banner: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=300&fit=crop",
    description: "Top up Diamond Free Fire murah, cepat, dan aman.",
    idLabel: "Player ID",
    denominations: [
      { id: "ff-70", label: "70 Diamonds", amount: 70, price: 10000 },
      { id: "ff-140", label: "140 Diamonds", amount: 140, price: 20000 },
      { id: "ff-355", label: "355 Diamonds", amount: 355, price: 50000 },
      { id: "ff-720", label: "720 Diamonds", amount: 720, price: 100000 },
      { id: "ff-1450", label: "1450 Diamonds", amount: 1450, price: 195000, originalPrice: 220000 },
      { id: "ff-3000", label: "3000 Diamonds", amount: 3000, price: 390000, originalPrice: 450000 },
    ],
    mockNicknames: {
      "111111": "FreeFireKing",
      "222222": "Garena_Pro",
      "333333": "HeadshotMaster",
    },
  },
  {
    slug: "pubg-mobile",
    name: "PUBG Mobile",
    category: "mobile",
    image: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=200&h=200&fit=crop",
    banner: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=800&h=300&fit=crop",
    description: "Beli UC PUBG Mobile dengan harga terbaik, proses instan!",
    idLabel: "Player ID",
    denominations: [
      { id: "pubg-60", label: "60 UC", amount: 60, price: 15000 },
      { id: "pubg-180", label: "180 UC", amount: 180, price: 43000 },
      { id: "pubg-325", label: "325 UC", amount: 325, price: 75000, originalPrice: 85000 },
      { id: "pubg-660", label: "660 UC", amount: 660, price: 150000, originalPrice: 170000 },
      { id: "pubg-1800", label: "1800 UC", amount: 1800, price: 400000, originalPrice: 460000 },
    ],
    mockNicknames: {
      "PUBG001": "BattleRoyale_ID",
      "PUBG002": "ChickenDinner",
    },
  },
  {
    slug: "genshin-impact",
    name: "Genshin Impact",
    category: "pc",
    image: "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=200&h=200&fit=crop",
    banner: "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=800&h=300&fit=crop",
    description: "Top up Genesis Crystals Genshin Impact untuk beli Primogem dan Character.",
    idLabel: "UID",
    serverLabel: "Server",
    denominations: [
      { id: "gs-60", label: "60 Genesis Crystals", amount: 60, price: 15000 },
      { id: "gs-300", label: "300+30 Genesis Crystals", amount: 330, price: 75000, originalPrice: 85000 },
      { id: "gs-980", label: "980+110 Genesis Crystals", amount: 1090, price: 240000, originalPrice: 280000 },
      { id: "gs-1980", label: "1980+260 Genesis Crystals", amount: 2240, price: 480000, originalPrice: 560000 },
      { id: "gs-3280", label: "3280+600 Genesis Crystals", amount: 3880, price: 800000 },
      { id: "gs-6480", label: "6480+1600 Genesis Crystals", amount: 8080, price: 1590000 },
    ],
    mockNicknames: {
      "700000001": "TravelerAether",
      "700000002": "LumineWorld",
    },
  },
  {
    slug: "valorant",
    name: "Valorant",
    category: "pc",
    image: "https://images.unsplash.com/photo-1627856013091-fed6dc4f7d8e?w=200&h=200&fit=crop",
    banner: "https://images.unsplash.com/photo-1627856013091-fed6dc4f7d8e?w=800&h=300&fit=crop",
    description: "Top up VP (Valorant Points) untuk unlock skin dan battle pass!",
    idLabel: "Riot ID",
    denominations: [
      { id: "vp-475", label: "475 VP", amount: 475, price: 60000 },
      { id: "vp-1000", label: "1000 VP", amount: 1000, price: 120000 },
      { id: "vp-2050", label: "2050 VP", amount: 2050, price: 240000 },
      { id: "vp-3650", label: "3650 VP", amount: 3650, price: 420000 },
      { id: "vp-5350", label: "5350 VP", amount: 5350, price: 600000 },
    ],
    mockNicknames: {
      "Viper#1234": "ValorantPro",
      "Phoenix#5678": "SentinelKing",
    },
  },
  {
    slug: "honor-of-kings",
    name: "Honor of Kings",
    category: "mobile",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&h=200&fit=crop",
    banner: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=300&fit=crop",
    description: "Top up Coupon Honor of Kings murah dan proses cepat!",
    idLabel: "Player ID",
    denominations: [
      { id: "hok-60", label: "60 Coupon", amount: 60, price: 8000 },
      { id: "hok-300", label: "300 Coupon", amount: 300, price: 40000 },
      { id: "hok-980", label: "980 Coupon", amount: 980, price: 130000, originalPrice: 150000 },
      { id: "hok-1980", label: "1980 Coupon", amount: 1980, price: 260000, originalPrice: 300000 },
    ],
    mockNicknames: {
      "HOK001": "KingSlayer",
      "HOK002": "DragonLord",
    },
  },
];

export function getGameBySlug(slug: string): Game | undefined {
  return games.find((g) => g.slug === slug);
}
