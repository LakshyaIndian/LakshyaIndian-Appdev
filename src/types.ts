export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
}

export interface Transcript {
  id: string;
  userId: string;
  fileName: string;
  content: string;
  bullArgs: string;
  bearArgs: string;
  summary: string;
  sentimentImageUrl: string;
  createdAt: string;
}

export interface Message {
  id: string;
  transcriptId: string;
  userId: string;
  role: 'user' | 'bull' | 'bear';
  content: string;
  createdAt: string;
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
