// Dynamic AI provider abstraction
import type { AiProvider, AiPlanRequest, AiPlanResponse, AiSuggestRequest, AiSuggestResponse } from '~/types/ai.d';
import { createGenericProvider } from './providers/generic';
import type { ProviderConfig } from './providers/generic';

type ProvidersConfig = Record<string, ProviderConfig>;

let cachedProvider: AiProvider | null = null;

async function loadProvider(): Promise<AiProvider> {
  if (cachedProvider) {
    return cachedProvider;
  }

  const model = (process.env.AI_MODEL?.toLowerCase() ?? 'gemma4') as keyof ProvidersConfig;

  // Dynamically import the JSON config (relative to this file)
  const configModule = await import('../../config/aiProviders.json');
  const config = (configModule as any).default as ProvidersConfig;

  const providerConfig = config[model];

  if (!providerConfig) {
    console.warn(`AI model "${model}" not found in config, falling back to default "gemma4"`);

    const fallback = config.gemma4;

    if (!fallback) {
      throw new Error('No fallback provider config found');
    }

    cachedProvider = createGenericProvider(fallback);

    return cachedProvider;
  }

  if (providerConfig.module) {
    // Load custom module if provided
    const customMod = await import(providerConfig.module);

    if (typeof customMod.getProvider === 'function') {
      cachedProvider = await customMod.getProvider();
      return cachedProvider!;
    }
  }

  // Use generic HTTP provider
  cachedProvider = createGenericProvider(providerConfig);

  return cachedProvider;
}

export async function generatePlan(request: AiPlanRequest): Promise<AiPlanResponse> {
  const provider = await loadProvider();
  return provider.generatePlan(request);
}

export async function getSuggestions(request: AiSuggestRequest): Promise<AiSuggestResponse> {
  const provider = await loadProvider();
  return provider.getSuggestions(request);
}
