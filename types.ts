
export interface ProductAnalysis {
  name: string;
  description: string;
  sellingPoints: string[];
  visualFeatures: string[];
  scenarios: string[];
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  ratio: string;
  status: 'loading' | 'success' | 'error';
  createdAt: number;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16';

export interface GenerationSettings {
  count: number;
  ratio: AspectRatio;
}

export type AppTab = 'studio' | 'history';
