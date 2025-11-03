// FIX: Import React to resolve the "Cannot find namespace 'React'" error.
import React, { ReactNode } from 'react';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  sources?: GroundingSource[];
  imageUrl?: string;
}

export interface Persona {
  id: string;
  isActive?: boolean;
  systemPrompt: string;
  role: string; // Character's Name
  personalityTraits: string;
  physicalTraits: string; // New
  lore: string; // New
  characterDescription: string; // A short summary, greeting, or first message
  avatarUrl: string; // Can be a web URL or a data URL
  scenario: string;
  voice?: string; // Voice URI for speech synthesis
}

export interface GroundingSource {
    uri: string;
    title: string;
    type: 'web' | 'maps';
}

export type FeatureId =
  | 'live'
  | 'chat'
  | 'image-analysis'
  | 'image-gen'
  | 'video-analysis'
  | 'audio-transcription'
  | 'file-library'
  | 'grounding'
  | 'reasoning'
  | 'settings';

export interface Feature {
  id: FeatureId;
  name: string;
  description: string;
  icon: ReactNode;
  component: React.ComponentType<any>; // Use 'any' to allow for varied props
}