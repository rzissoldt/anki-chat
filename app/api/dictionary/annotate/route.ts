import { getDictionary } from "@/lib/dictionary/cedict";
import { annotateContextualGlosses } from "@/lib/dictionary/contextual-gloss";
import { extractL1PracticeSpans } from "@/lib/dictionary/practice-spans";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  text: z.string().min(1).max(20_000),
  lang: z.enum(["en", "de"]).default("en"),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Text must contain between 1 and 20,000 characters." },
      { status: 400 },
    );
  }

  try {
    const dictionary = await getDictionary(parsed.data.lang);
    const text = parsed.data.text;
    const spans = extractL1PracticeSpans(text);
    const [chinese, contextual] = await Promise.all([
      Promise.resolve(dictionary.annotate(text)),
      annotateContextualGlosses(text, spans, parsed.data.lang, request.signal),
    ]);
    return Response.json({
      lang: parsed.data.lang,
      segments: [...chinese, ...contextual],
    });
  } catch (error) {
    console.error("Dictionary annotation failed:", error);
    return Response.json({ error: "Dictionary is unavailable." }, { status: 503 });
  }
}
