import { readFileSync } from "node:fs";
import { join } from "node:path";

const systemPromptPath = join(process.cwd(), "Systemprompt.md");
const lessonPromptPath = join(process.cwd(), "Systemprompt.lesson.md");

export const systemPrompt = readFileSync(systemPromptPath, "utf8").trim();

if (!systemPrompt) {
  throw new Error(`System prompt is empty: ${systemPromptPath}`);
}

export const lessonSystemPrompt = readFileSync(lessonPromptPath, "utf8").trim();

if (!lessonSystemPrompt) {
  throw new Error(`Lesson system prompt is empty: ${lessonPromptPath}`);
}

export function buildSystemPrompt(lesson: boolean): string {
  return lesson ? `${systemPrompt}\n\n${lessonSystemPrompt}` : systemPrompt;
}
