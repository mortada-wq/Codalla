/*
 * Generic AI provider implementation
 * Path: app/lib/api/providers/generic.ts
 */

import type { AiProvider, AiPlanRequest, AiPlanResponse, AiSuggestRequest, AiSuggestResponse } from '~/types/ai.d';

export interface ProviderConfig {
  module: string | null; // optional custom module path
  baseUrl: string; // e.g. https://api.provider.com/v1
  apiKeyEnv: string; // name of env var containing the API key
}

function getApiKey(envVar: string): string | undefined {
  return process.env[envVar];
}

export function createGenericProvider(config: ProviderConfig): AiProvider {
  const apiKey = getApiKey(config.apiKeyEnv);

  async function post<T>(endpoint: string, body: any): Promise<T> {
    const url = `${config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.warn(`Generic AI provider received non‑OK status ${response.status} from ${url}`);
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (err) {
      console.error(`Error contacting AI provider at ${url}:`, err);

      // Return a mock response so the app stays functional
      if (endpoint === '/plan') {
        const mock: AiPlanResponse = { plan: { tasks: [], wireframes: [], accessibility: [] } };
        return mock as unknown as T;
      } else {
        const mock: AiSuggestResponse = { suggestions: [] };
        return mock as unknown as T;
      }
    }
  }

  return {
    async generatePlan(request: AiPlanRequest): Promise<AiPlanResponse> {
      return await post<AiPlanResponse>('/plan', request);
    },
    async getSuggestions(request: AiSuggestRequest): Promise<AiSuggestResponse> {
      return await post<AiSuggestResponse>('/suggest', request);
    },
  };
}
