import { getDictionary } from "@/lib/dictionary/cedict";
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
    return Response.json({
      lang: parsed.data.lang,
      segments: dictionary.annotate(parsed.data.text),
    });
  } catch (error) {
    console.error("Dictionary annotation failed:", error);
    return Response.json({ error: "Dictionary is unavailable." }, { status: 503 });
  }
}
