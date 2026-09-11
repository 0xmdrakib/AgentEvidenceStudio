import { AiRequestError } from './ai-policy.ts';

export interface AiConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  endpoint: string;
}

export function getAiConfig(
  env: Record<string, string | undefined> = process.env,
): AiConfig {
  const apiKey = env.AI_API_KEY?.trim();
  const model = env.AI_MODEL?.trim();
  const baseUrl = env.AI_BASE_URL?.trim();
  if (!apiKey || !model || !baseUrl)
    throw new AiRequestError('Research is awaiting administrator setup.', 503);
  if (
    model.length > 200 ||
    /\s/.test(model) ||
    [...model].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new AiRequestError(
      'The research model configuration is invalid.',
      503,
    );
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new AiRequestError(
      'The research endpoint configuration is invalid.',
      503,
    );
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.hostname.includes('.') ||
    /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(
      url.hostname,
    ) ||
    /\.(local|internal|localhost)$/i.test(url.hostname)
  ) {
    throw new AiRequestError(
      'The research endpoint must be a public HTTPS base URL.',
      503,
    );
  }
  const normalized = url.href.replace(/\/+$/, '');
  if (/\/(chat\/completions|responses|anthropic)$/.test(normalized))
    throw new AiRequestError(
      'Use the provider’s OpenAI-compatible base URL.',
      503,
    );
  return {
    apiKey,
    model,
    baseUrl: normalized,
    endpoint: `${normalized}/chat/completions`,
  };
}
