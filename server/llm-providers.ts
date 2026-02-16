import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface LLMProvider {
  id: string;
  name: string;
  model: string;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  available: boolean;
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
}

const PROVIDERS_CONFIG: Record<string, {
  name: string;
  model: string;
  costPer1kInput: number;
  costPer1kOutput: number;
  envKey: string;
  supportsJsonMode: boolean;
}> = {
  openai: {
    name: "OpenAI (GPT-5 Mini)",
    model: "gpt-5-mini",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    envKey: "OPENAI_API_KEY",
    supportsJsonMode: true,
  },
  deepseek: {
    name: "DeepSeek (V3)",
    model: "deepseek-chat",
    costPer1kInput: 0.00028,
    costPer1kOutput: 0.00042,
    envKey: "DEEPSEEK_API_KEY",
    supportsJsonMode: true,
  },
  gemini: {
    name: "Google Gemini (2.0 Flash)",
    model: "gemini-2.0-flash",
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
    envKey: "GEMINI_API_KEY",
    supportsJsonMode: true,
  },
  claude: {
    name: "Claude (Sonnet 4)",
    model: "claude-sonnet-4-20250514",
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    envKey: "CLAUDE_API_KEY",
    supportsJsonMode: false,
  },
  minimax: {
    name: "MiniMax (M2.5)",
    model: "MiniMax-M2.5",
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    envKey: "MINIMAX_API_KEY",
    supportsJsonMode: false,
  },
};

function resolveApiKey(providerId: string, config: { envKey: string }): string | undefined {
  if (providerId === "openai") {
    return process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  }
  return process.env[config.envKey];
}

export function getAvailableProviders(): LLMProvider[] {
  return Object.entries(PROVIDERS_CONFIG).map(([id, config]) => ({
    id,
    name: config.name,
    model: config.model,
    costPer1kInputTokens: config.costPer1kInput,
    costPer1kOutputTokens: config.costPer1kOutput,
    available: !!resolveApiKey(id, config),
  }));
}

function calculateCost(inputTokens: number, outputTokens: number, providerId: string): number {
  const config = PROVIDERS_CONFIG[providerId];
  if (!config) return 0;
  return (inputTokens / 1000) * config.costPer1kInput + (outputTokens / 1000) * config.costPer1kOutput;
}

function extractJSON(text: string): string {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

async function callOpenAICompatible(
  baseURL: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  providerId: string,
  supportsJsonMode: boolean
): Promise<LLMResponse> {
  const client = new OpenAI({ apiKey, baseURL });

  const useMaxCompletionTokens = model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4");
  const requestParams: any = {
    model,
    messages: [
      { role: "system", content: systemPrompt + (supportsJsonMode ? "" : "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences, just raw JSON.") },
      { role: "user", content: userPrompt },
    ],
    ...(useMaxCompletionTokens ? { max_completion_tokens: 8192 } : { max_tokens: 8192 }),
  };

  if (supportsJsonMode) {
    requestParams.response_format = { type: "json_object" };
  }

  const response = await client.chat.completions.create(requestParams);

  let content = response.choices[0]?.message?.content || "";
  if (!supportsJsonMode) {
    content = extractJSON(content);
  }

  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;

  return {
    content,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: calculateCost(inputTokens, outputTokens, providerId),
  };
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: PROVIDERS_CONFIG.claude.model,
    max_tokens: 8192,
    system: systemPrompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences, just raw JSON.",
    messages: [
      { role: "user", content: userPrompt },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  let content = textBlock ? textBlock.text : "";
  content = extractJSON(content);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    content,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: calculateCost(inputTokens, outputTokens, "claude"),
  };
}

async function callMiniMax(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResponse> {
  const response = await fetch("https://api.minimax.io/v1/text/chatcompletion_v2", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: PROVIDERS_CONFIG.minimax.model,
      messages: [
        { role: "system", name: "assistant", content: systemPrompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code fences, just raw JSON." },
        { role: "user", name: "user", content: userPrompt },
      ],
      max_completion_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`MiniMax API error (${response.status}): ${errText}`);
  }

  const data = await response.json();

  if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax error: ${data.base_resp.status_msg || "Unknown error"}`);
  }

  let content = data.choices?.[0]?.message?.content || "";
  content = extractJSON(content);

  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  return {
    content,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUsd: calculateCost(inputTokens, outputTokens, "minimax"),
  };
}

export async function callLLM(
  providerId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<LLMResponse> {
  const config = PROVIDERS_CONFIG[providerId];
  if (!config) {
    throw new Error(`Unknown provider: ${providerId}. Valid providers: ${Object.keys(PROVIDERS_CONFIG).join(", ")}`);
  }

  const apiKey = resolveApiKey(providerId, config);
  if (!apiKey) {
    throw new Error(`API key not configured for ${config.name}. Set ${config.envKey} in secrets.`);
  }

  switch (providerId) {
    case "openai":
      return callOpenAICompatible(
        process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
        apiKey,
        config.model,
        systemPrompt,
        userPrompt,
        providerId,
        config.supportsJsonMode
      );
    case "deepseek":
      return callOpenAICompatible(
        "https://api.deepseek.com/v1",
        apiKey,
        config.model,
        systemPrompt,
        userPrompt,
        providerId,
        config.supportsJsonMode
      );
    case "gemini":
      return callOpenAICompatible(
        "https://generativelanguage.googleapis.com/v1beta/openai/",
        apiKey,
        config.model,
        systemPrompt,
        userPrompt,
        providerId,
        config.supportsJsonMode
      );
    case "claude":
      return callClaude(apiKey, systemPrompt, userPrompt);
    case "minimax":
      return callMiniMax(apiKey, systemPrompt, userPrompt);
    default:
      throw new Error(`Provider ${providerId} not implemented`);
  }
}
