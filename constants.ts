
import { AspectRatio } from "./types";

export const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1 (方形 - 亚马逊标准)' },
  { value: '3:4', label: '3:4 (竖构图 - 详情页)' },
  { value: '4:3', label: '4:3 (横构图 - 场景图)' },
  { value: '9:16', label: '9:16 (全屏 - 移动端/快拍)' },
  { value: '16:9', label: '16:9 (影院级 - 视频封面)' },
];

export const MAX_IMAGES = 8;
export const MIN_IMAGES = 1;

export const TABS = {
  STUDIO: 'studio',
  HISTORY: 'history'
};
