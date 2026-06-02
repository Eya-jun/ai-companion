// 工具类型定义

export interface ParsedSegment {
  type: 'scene' | 'dialogue' | 'blank';
  content: string;
  action?: string;
}
