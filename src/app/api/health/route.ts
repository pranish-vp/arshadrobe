import { NextResponse } from "next/server";
import { activeModels, hasApiKey } from "@/lib/server/ai";
import { hasDb } from "@/lib/server/db";
import { storageMode } from "@/lib/server/storage";

export function GET() {
  const { provider, textModel, imageModel } = activeModels();
  return NextResponse.json({
    provider,
    configured: hasApiKey(),
    textModel,
    imageModel,
    db: hasDb(),
    imageStorage: storageMode(),
  });
}
