// The demo store's catalog (spec §6.3): realistic names, style numbers, colors
// and sizes. Plan says where each goes: H hung on the floor, F folded on the
// floor, HF both, B a stockroom bin, HB hung and a bin, - not placed yet (for
// the Week 6 "new product with no place" demo). A few are sold out or on sale
// for the Week 7 Quick Adjust demo.

import type { ProductStatus } from "@/lib/product-status";

export type Plan = "H" | "F" | "HF" | "B" | "HB" | "-";

export const DEMO_CATEGORIES = [
  { name: "Tees", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 10 },
  { name: "Knits", hungColumns: 1, hungRows: 3, foldedColumns: 2, foldedRows: 2, stackLimit: 6 },
  { name: "Denim", hungColumns: 1, hungRows: 4, foldedColumns: 2, foldedRows: 2, stackLimit: 8 },
  { name: "Pants", hungColumns: 1, hungRows: 4, foldedColumns: 2, foldedRows: 2, stackLimit: 8 },
  { name: "Dresses", hungColumns: 1, hungRows: 4, foldedColumns: 2, foldedRows: 2, stackLimit: 4 },
  { name: "Outerwear", hungColumns: 2, hungRows: 4, foldedColumns: 3, foldedRows: 2, stackLimit: 3 },
  { name: "Accessories", hungColumns: 1, hungRows: 1, foldedColumns: 1, foldedRows: 1, stackLimit: 12 },
] as const;

type Row = [name: string, styleNumber: string, category: (typeof DEMO_CATEGORIES)[number]["name"], color: string, hex: string, sizeRange: string, status: ProductStatus, plan: Plan];

const ROWS: Row[] = [
  ["Everyday Crew Tee", "LB-T101", "Tees", "White", "#f2efe8", "XS–XXL", "in_stock", "F"],
  ["Everyday Crew Tee", "LB-T102", "Tees", "Black", "#1f1f1f", "XS–XXL", "in_stock", "F"],
  ["Slub Pocket Tee", "LB-T110", "Tees", "Oatmeal", "#d9cbb0", "XS–XL", "in_stock", "F"],
  ["Boxy Cropped Tee", "LB-T120", "Tees", "Sage", "#9caf88", "XS–XL", "in_stock", "HF"],
  ["Ringer Tee", "LB-T130", "Tees", "Navy", "#2b3a55", "S–XL", "sold_out", "F"],
  ["Long-Line Tee", "LB-T140", "Tees", "Clay", "#b5654a", "XS–XL", "in_stock", "H"],
  ["Graphic Bloom Tee", "LB-T150", "Tees", "Cream", "#efe6d2", "XS–XL", "on_sale", "F"],
  ["Ribbed Tank", "LB-T160", "Tees", "Black", "#1f1f1f", "XS–L", "in_stock", "B"],
  ["Cloud Crew Sweater", "LB-K201", "Knits", "Heather Grey", "#a7a7a2", "XS–XL", "in_stock", "F"],
  ["Cloud Crew Sweater", "LB-K202", "Knits", "Ivory", "#ece4d4", "XS–XL", "in_stock", "F"],
  ["Cable Cardigan", "LB-K210", "Knits", "Camel", "#b88a57", "XS–XL", "in_stock", "H"],
  ["Waffle Henley", "LB-K220", "Knits", "Moss", "#6b7a4f", "S–XXL", "in_stock", "HF"],
  ["Mock-Neck Sweater", "LB-K230", "Knits", "Burgundy", "#6e2433", "XS–XL", "on_sale", "F"],
  ["Cropped Cardigan", "LB-K240", "Knits", "Blush", "#e3b7ad", "XS–L", "in_stock", "B"],
  ["Merino Polo", "LB-K250", "Knits", "Navy", "#2b3a55", "S–XL", "in_stock", "-"],
  ["High-Rise Straight Jean", "LB-D301", "Denim", "Indigo", "#2f3e6b", "24–34", "in_stock", "HF"],
  ["High-Rise Straight Jean", "LB-D302", "Denim", "Black", "#1f1f1f", "24–34", "in_stock", "F"],
  ["Wide-Leg Jean", "LB-D310", "Denim", "Light Wash", "#9db4cf", "24–34", "in_stock", "H"],
  ["Relaxed Mom Jean", "LB-D320", "Denim", "Mid Wash", "#5f7fa8", "24–32", "sold_out", "F"],
  ["Skinny Jean", "LB-D330", "Denim", "Rinse", "#263252", "24–34", "in_stock", "B"],
  ["Denim Jacket", "LB-D340", "Denim", "Mid Wash", "#5f7fa8", "XS–XL", "in_stock", "H"],
  ["Barrel Jean", "LB-D350", "Denim", "Ecru", "#e5dcc5", "24–32", "on_sale", "H"],
  ["Bootcut Jean", "LB-D360", "Denim", "Dark Wash", "#2a3550", "24–34", "in_stock", "-"],
  ["High-Rise Pant", "LB-P401", "Pants", "Black", "#1f1f1f", "0–14", "in_stock", "HF"],
  ["Pleated Trouser", "LB-P410", "Pants", "Taupe", "#8f7e6b", "0–14", "in_stock", "H"],
  ["Linen Drawstring Pant", "LB-P420", "Pants", "Natural", "#d8cdb4", "XS–XL", "in_stock", "F"],
  ["Utility Cargo Pant", "LB-P430", "Pants", "Olive", "#5c6440", "XS–XL", "sold_out", "H"],
  ["Ponte Legging", "LB-P440", "Pants", "Black", "#1f1f1f", "XS–XL", "in_stock", "F"],
  ["Wide-Leg Trouser", "LB-P450", "Pants", "Cocoa", "#5a3e2e", "0–14", "in_stock", "B"],
  ["Chino Short", "LB-P460", "Pants", "Khaki", "#b8a77f", "0–14", "in_stock", "-"],
  ["Slip Midi Dress", "LB-R501", "Dresses", "Champagne", "#d8c3a0", "XS–XL", "in_stock", "H"],
  ["Wrap Dress", "LB-R510", "Dresses", "Floral Navy", "#33405f", "XS–XL", "in_stock", "H"],
  ["T-Shirt Dress", "LB-R520", "Dresses", "Heather Grey", "#a7a7a2", "XS–XL", "on_sale", "H"],
  ["Smocked Maxi Dress", "LB-R530", "Dresses", "Terracotta", "#b4583c", "XS–L", "in_stock", "H"],
  ["Knit Midi Dress", "LB-R540", "Dresses", "Black", "#1f1f1f", "XS–XL", "in_stock", "HB"],
  ["Shirt Dress", "LB-R550", "Dresses", "Chambray", "#7d93b2", "XS–XL", "in_stock", "B"],
  ["Linen Mini Dress", "LB-R560", "Dresses", "White", "#f2efe8", "XS–L", "in_stock", "-"],
  ["Wool Blend Coat", "LB-O601", "Outerwear", "Camel", "#b88a57", "XS–XL", "in_stock", "H"],
  ["Quilted Liner Jacket", "LB-O610", "Outerwear", "Olive", "#5c6440", "XS–XL", "in_stock", "H"],
  ["Cropped Puffer", "LB-O620", "Outerwear", "Black", "#1f1f1f", "XS–XL", "sold_out", "H"],
  ["Trench Coat", "LB-O630", "Outerwear", "Stone", "#b9ad95", "XS–XL", "in_stock", "H"],
  ["Fleece Half-Zip", "LB-O640", "Outerwear", "Cream", "#efe6d2", "XS–XL", "in_stock", "F"],
  ["Rain Shell", "LB-O650", "Outerwear", "Slate", "#5b6670", "XS–XL", "in_stock", "B"],
  ["Canvas Tote", "LB-A701", "Accessories", "Natural", "#d8cdb4", "One size", "in_stock", "F"],
  ["Leather Belt", "LB-A710", "Accessories", "Cognac", "#8a4b2a", "S–XL", "in_stock", "H"],
  ["Knit Beanie", "LB-A720", "Accessories", "Rust", "#a5502e", "One size", "in_stock", "F"],
  ["Silk Scarf", "LB-A730", "Accessories", "Bloom Print", "#c98a7d", "One size", "in_stock", "H"],
  ["Baseball Cap", "LB-A740", "Accessories", "Navy", "#2b3a55", "One size", "in_stock", "B"],
  ["Crossbody Bag", "LB-A750", "Accessories", "Black", "#1f1f1f", "One size", "in_stock", "F"],
  ["Hoop Earrings", "LB-A760", "Accessories", "Gold", "#b8954a", "One size", "in_stock", "-"],
];

export const DEMO_PRODUCTS = ROWS.map(([name, styleNumber, category, color, hex, sizeRange, status, plan]) => ({
  name, styleNumber, category, color, hex, sizeRange, status, plan,
}));

export const DEMO_BIN_CODES = Array.from({ length: 12 }, (_, i) => `B-${String(i + 1).padStart(2, "0")}`);
