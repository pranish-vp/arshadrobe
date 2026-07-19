/** JSON shapes shared between the client db facade and the data API routes. */
import type {
  Category,
  Formality,
  Pattern,
  Season,
} from "./types";

export interface ImagePayload {
  data: string; // base64, no data: prefix
  mimeType: string;
}

export interface GarmentWire {
  id: string;
  createdAt: number;
  category: Category;
  subcategory: string;
  colors: string[];
  pattern: Pattern;
  material: string;
  seasons: Season[];
  formality: Formality;
  description: string;
  favorite: boolean;
  wearCount: number;
  image: ImagePayload;
  cutout?: ImagePayload;
}

export interface OutfitWire {
  id: string;
  createdAt: number;
  title: string;
  occasion: string;
  vibe: string;
  explanation: string;
  tip?: string;
  garmentIds: string[];
  favorite: boolean;
  wornDates: number[];
  tryOn?: ImagePayload;
}

export interface ProfileWire {
  name: string;
  vibes: string[];
  onboarded: boolean;
  photo?: ImagePayload;
}
