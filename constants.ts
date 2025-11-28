import { AspectRatio } from "./types";

export const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1 (Square - Standard)' },
  { value: '3:4', label: '3:4 (Portrait)' },
  { value: '4:3', label: '4:3 (Landscape)' },
  { value: '9:16', label: '9:16 (Mobile/Story)' },
  { value: '16:9', label: '16:9 (Cinematic)' },
];

export const MAX_IMAGES = 8;
export const MIN_IMAGES = 1;
