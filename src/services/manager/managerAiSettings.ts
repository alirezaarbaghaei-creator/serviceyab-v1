/**
 * AI settings for the Life Manager assistant — local-first (safeStorage),
 * with optional Supabase `ai_settings` table sync when a session exists.
 * Port of life_manager/src/services/ai/aiSettingsService.ts.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AISettings } from '@/types/manager';
import { localGet, localSet, localRemove } from './storage';

const KEY = 'ai_settings';

function toAISettings(data: Record<string, unknown>): AISettings {
  return {
    id: data.id as string,
    userId: data.user_id as string,
    apiKey: data.api_key as string,
    baseUrl: data.base_url as string,
    model: data.model as string,
    enabled: data.enabled as boolean,
    createdAt: data.created_at as string | undefined,
    updatedAt: data.updated_at as string | undefined,
  };
}

async function hasSession(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

export async function getAISettings(): Promise<AISettings | null> {
  // Cloud first when a session exists
  if (await hasSession()) {
    try {
      const { data, error } = await supabase.from('ai_settings').select('*').maybeSingle();
      if (!error && data) {
        const settings = toAISettings(data);
        localSet(KEY, settings);
        return settings;
      }
    } catch {
      /* fall through to local */
    }
  }
  return localGet<AISettings>(KEY);
}

export async function saveAISettings(
  settings: { apiKey: string; baseUrl: string; model: string; enabled: boolean },
): Promise<AISettings | null> {
  const now = new Date().toISOString();
  const existing = await getAISettings();
  const local: AISettings = {
    ...existing,
    userId: existing?.userId ?? 'local',
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    model: settings.model,
    enabled: settings.enabled,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  localSet(KEY, local);

  if (await hasSession()) {
    try {
      if (existing?.id) {
        const { data, error } = await supabase
          .from('ai_settings')
          .update({
            api_key: settings.apiKey,
            base_url: settings.baseUrl,
            model: settings.model,
            enabled: settings.enabled,
            updated_at: now,
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (!error && data) {
          const cloud = toAISettings(data);
          localSet(KEY, cloud);
          return cloud;
        }
      } else {
        const { data, error } = await supabase
          .from('ai_settings')
          .insert({
            api_key: settings.apiKey,
            base_url: settings.baseUrl,
            model: settings.model,
            enabled: settings.enabled,
          })
          .select()
          .single();
        if (!error && data) {
          const cloud = toAISettings(data);
          localSet(KEY, cloud);
          return cloud;
        }
      }
    } catch {
      /* local copy remains authoritative */
    }
  }
  return local;
}

export async function clearAISettings(): Promise<void> {
  localRemove(KEY);
}

export async function testAISettings(
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'سلام' }],
        max_tokens: 20,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, message: `خطای API: ${response.status}` };
    }

    return { success: true, message: 'اتصال موفق بود!' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, message: 'پاسخی از سرور دریافت نشد (مهلت تمام شد)' };
    }
    return { success: false, message: 'خطا در ارتباط با سرور' };
  }
}
