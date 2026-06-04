// 预设角色加载器
//
// 每个预设角色对应 backend/data/characters/ 下一个 .md 文件:
//   ---
//   name: 林默
//   description: 青梅竹马·ENFP·建筑系大三
//   avatar: 🌳
//   greeting: 嘿！又见面啦！
//   ---
//
//   <system_prompt 的全部内容写在这里,支持多行>
//
// 改完 .md 后,开发模式下会自动同步到 Supabase(由 chokidar 监听触发)。
// 生产模式只在启动时同步一次。

import fs from 'fs';
import path from 'path';

export interface PresetCharacter {
  name: string;
  description: string;
  system_prompt: string;
  avatar: string;
  is_preset: boolean;
  greeting: string;
}

/** 解析单行 frontmatter:`key: value` 或 `key: "value"` */
function parseFrontmatterLine(line: string): [string, string] | null {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
  if (!m) return null;
  let value = m[2].trim();
  // 去掉首尾成对引号
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return [m[1], value];
}

/**
 * 解析一个角色 .md 文件,返回 PresetCharacter。
 * 失败时抛出包含文件名的清晰错误。
 */
function parseCharacterFile(filePath: string): PresetCharacter {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // 必须以 --- 开头
  if (!raw.startsWith('---')) {
    throw new Error(`缺少 YAML frontmatter (需以 --- 开头): ${filePath}`);
  }

  // 找第二个 ---
  const rest = raw.slice(3);
  // 跳过 --- 之后的换行
  const nlIdx = rest.indexOf('\n');
  if (nlIdx === -1) {
    throw new Error(`frontmatter 格式不完整: ${filePath}`);
  }
  const afterFirstLine = rest.slice(nlIdx + 1);
  const closeIdx = afterFirstLine.indexOf('\n---');
  if (closeIdx === -1) {
    throw new Error(`找不到 frontmatter 结束标记 ---: ${filePath}`);
  }

  const fmBlock = afterFirstLine.slice(0, closeIdx);
  // body 从 closeIdx 之后开始,跳过 \n---
  let body = afterFirstLine.slice(closeIdx + 4);
  if (body.startsWith('\n')) body = body.slice(1);
  body = body.trim();

  const meta: Record<string, string> = {};
  for (const line of fmBlock.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = parseFrontmatterLine(line);
    if (kv) meta[kv[0]] = kv[1];
  }

  const name = meta.name;
  if (!name) {
    throw new Error(`frontmatter 缺少 name 字段: ${filePath}`);
  }

  return {
    name,
    description: meta.description ?? '',
    avatar: meta.avatar ?? '👤',
    greeting: meta.greeting ?? '你好。',
    system_prompt: body,
    is_preset: true,
  };
}

/**
 * 从 backend/data/characters/ 加载所有预设角色。
 * 目录不存在 → 返回空数组(开发期允许尚未创建)。
 * 单个文件解析失败 → 抛错(必须修)。
 */
export async function loadPresetCharacters(): Promise<PresetCharacter[]> {
  const dir = path.resolve(process.cwd(), 'data/characters');
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  预设角色目录不存在: ${dir}`);
    return [];
  }

  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.toUpperCase().startsWith('README'));

  const presets: PresetCharacter[] = [];
  for (const f of files) {
    const full = path.join(dir, f);
    presets.push(parseCharacterFile(full));
  }

  return presets;
}
