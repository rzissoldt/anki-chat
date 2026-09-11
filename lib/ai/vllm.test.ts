import { describe, expect, it } from "vitest";
import { addThinkingConfig } from "@/lib/ai/vllm";

describe("addThinkingConfig", () => {
  it("disables Qwen thinking through vLLM chat template kwargs", () => {
    expect(addThinkingConfig({ stream: true }, false)).toEqual({
      stream: true,
      chat_template_kwargs: {
        enable_thinking: false,
      },
    });
  });

  it("preserves other chat template kwargs", () => {
    expect(addThinkingConfig({ chat_template_kwargs: { custom_option: "value" } }, true)).toEqual({
      chat_template_kwargs: {
        custom_option: "value",
        enable_thinking: true,
      },
    });
  });
});
