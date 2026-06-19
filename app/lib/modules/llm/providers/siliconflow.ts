import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class SiliconFlowProvider extends BaseProvider {
  name = 'SiliconFlow';
  getApiKeyLink = 'https://cloud.siliconflow.cn/account/ak';

  config = {
    baseUrlKey: 'SILICONFLOW_API_BASE_URL',
    apiTokenKey: 'SILICONFLOW_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'deepseek-ai/DeepSeek-V4-Pro',
      label: 'DeepSeek V4 Pro',
      provider: 'SiliconFlow',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'deepseek-ai/DeepSeek-R1',
      label: 'DeepSeek R1',
      provider: 'SiliconFlow',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'deepseek-ai/DeepSeek-V3',
      label: 'DeepSeek V3',
      provider: 'SiliconFlow',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'SILICONFLOW_API_BASE_URL',
      defaultApiTokenKey: 'SILICONFLOW_API_KEY',
    });

    const base = baseUrl || 'https://api.siliconflow.com/v1';

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as any;
      const staticIds = this.staticModels.map((m) => m.name);

      return (data.data || [])
        .filter((m: any) => !staticIds.includes(m.id))
        .map((m: any) => ({
          name: m.id,
          label: m.id,
          provider: this.name,
          maxTokenAllowed: 128000,
          maxCompletionTokens: 8192,
        }));
    } catch {
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'SILICONFLOW_API_BASE_URL',
      defaultApiTokenKey: 'SILICONFLOW_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl || 'https://api.siliconflow.com/v1', apiKey, model);
  }
}
