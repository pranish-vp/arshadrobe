import { NextResponse } from "next/server";
import { hasApiKey, IMAGE_MODEL, TEXT_MODEL } from "@/lib/server/ai";
import { hasDb } from "@/lib/server/db";
import { storageMode } from "@/lib/server/storage";

export function GET() {
  return NextResponse.json({
    provider: "openai",
    configured: hasApiKey(),
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL,
    db: hasDb(),
    imageStorage: storageMode(),
  });
}
