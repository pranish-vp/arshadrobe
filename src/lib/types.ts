/** Shared domain types for Arshadrobe. */

export type Category =
  | "top"
  | "bottom"
  | "dress"
  | "outerwear"
  | "shoes"
  | "accessory"
  | "other";

export type Formality = "casual" | "smart-casual" | "formal" | "sport";

export type Season = "spring" | "summer" | "autumn" | "winter" | "all";

export type Pattern =
  | "solid"
  | "striped"
  | "checked"
  | "floral"
  | "graphic"
  | "textured"
  | "other";

export interface GarmentTags {
  category: Category;
  subcategory: string;
  colors: string[];
  pattern: Pattern;
  material: string;
  seasons: Season[];
  formality: Formality;
  description: string;
}

export interface Garment extends GarmentTags {
  id: string;
  createdAt: number;
  /** Original (resized) photo. */
  image: Blob;
  /** Background-removed cutout, when available. */
  cutout?: Blob;
  favorite: boolean;
  wearCount: number;
}

export interface Profile {
  name: string;
  /** Full-body photo used for virtual try-on. */
  photo?: Blob;
  vibes: string[];
  onboarded: boolean;
}

export interface Outfit {
  id: string;
  createdAt: number;
  title: string;
  occasion: string;
  vibe: string;
  explanation: string;
  tip?: string;
  garmentIds: string[];
  /** Generated try-on render, when available. */
  tryOn?: Blob;
  favorite: boolean;
  /** Timestamps of days this outfit was worn. */
  wornDates: number[];
}

/** One outfit suggestion coming back from the stylist (AI or fallback). */
export interface OutfitOption {
  title: string;
  garmentIds: string[];
  explanation: string;
  tip?: string;
}

export interface StylistContext {
  occasion: string;
  vibe: string;
  weather: string;
  note?: string;
}

export const CATEGORIES: Category[] = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "accessory",
  "other",
];

export const FORMALITIES: Formality[] = [
  "casual",
  "smart-casual",
  "formal",
  "sport",
];

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter", "all"];

export const PATTERNS: Pattern[] = [
  "solid",
  "striped",
  "checked",
  "floral",
  "graphic",
  "textured",
  "other",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  outerwear: "Outerwear",
  shoes: "Shoes",
  accessory: "Accessories",
  other: "Other",
};

export const VIBE_OPTIONS = [
  "Minimal",
  "Classic",
  "Streetwear",
  "Bold",
  "Romantic",
  "Edgy",
  "Sporty",
  "Comfy-first",
];

export const OCCASIONS = [
  "Casual day",
  "Work",
  "Date night",
  "Party",
  "Wedding / event",
  "Workout",
  "Travel",
];

export const STYLE_VIBES = [
  "Comfy",
  "Polished",
  "Minimal",
  "Bold",
  "Romantic",
  "Edgy",
];
