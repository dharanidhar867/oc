// Catalog categories (the list instructors pick from). Course content comes from Convex, never from here.

export type Category = { name: string; hue: number };

export const CATS: Category[] = (
  [
    ["Development", 300],
    ["Business", 220],
    ["Finance & Accounting", 150],
    ["IT & Software", 260],
    ["Office Productivity", 90],
    ["Personal Development", 40],
    ["Design", 10],
    ["Marketing", 60],
    ["Lifestyle", 330],
    ["Photography & Video", 200],
    ["Health & Fitness", 130],
    ["Music", 280],
    ["Teaching & Academics", 110],
    ["Languages", 170],
  ] as [string, number][]
).map(([name, hue]) => ({ name, hue }));

export const LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];
export const SORTS: [string, string][] = [
  ["new", "Newest"],
  ["low", "Price: low to high"],
];
export const PAYS: [string, string][] = [
  ["card", "Card"],
  ["upi", "UPI"],
  ["paypal", "PayPal"],
];
export const MINE_TABS = ["All", "Wishlist", "Archived"];

export const money = (n: number) => "$" + n.toFixed(2);
export const fmt = (n: number) => n.toLocaleString("en-US");
