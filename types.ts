export interface TranslationResult {
  exists: boolean;
  description?: string;
  imageUrl?: string;
  error?: string;
}

export enum AppState {
  LANDING = 'LANDING',
  INTERFACE = 'INTERFACE',
}