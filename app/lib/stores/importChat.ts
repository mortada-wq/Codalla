import { atom } from 'nanostores';
import type { Message } from 'ai';

type ImportChatFn = (description: string, messages: Message[]) => Promise<void>;

export const importChatStore = atom<ImportChatFn | null>(null);
