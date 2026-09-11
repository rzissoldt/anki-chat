import { readFileSync } from "node:fs";
import { join } from "node:path";

const systemPromptPath = join(process.cwd(), "Systemprompt.md");

export const systemPrompt = readFileSync(systemPromptPath, "utf8").trim();

if (!systemPrompt) {
  throw new Error(`System prompt is empty: ${systemPromptPath}`);
}
