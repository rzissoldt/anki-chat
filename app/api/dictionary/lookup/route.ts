import { getDictionary } from "@/lib/dictionary/cedict";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  words: z.array(z.string().trim().min(1).max(32)).min(1).max(100),
  lang: z.enum(["en", "de"]).default("en"),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Provide between 1 and 100 valid words." }, { status: 400 });
  }

  try {
    const dictionary = await getDictionary(parsed.data.lang);
    const words = [...new Set(parsed.data.words)];
    return Response.json({
      lang: parsed.data.lang,
      results: words.map((word) => ({ word, entries: dictionary.lookup(word) })),
    });
  } catch (error) {
    console.error("Dictionary lookup failed:", error);
    return Response.json({ error: "Dictionary is unavailable." }, { status: 503 });
  }
}
