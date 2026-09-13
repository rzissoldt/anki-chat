import OpenCC from "opencc-js";

export type ChineseScript = "simplified" | "traditional";

// Taiwan orthography without regional vocab swaps (消息 stays 消息, not 訊息).
const toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
const toSimplified = OpenCC.Converter({ from: "tw", to: "cn" });

export function convertChineseScript(text: string, script: ChineseScript): string {
  if (!text) return text;
  return script === "traditional" ? toTraditional(text) : toSimplified(text);
}

export function createScriptConverter() {
  return convertChineseScript;
}
