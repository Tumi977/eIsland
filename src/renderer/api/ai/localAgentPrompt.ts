/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file localAgentPrompt.ts
 * @description 本地 Agent（Ollama / 自定义 API 直连）系统提示词获取
 * @description 优先使用服务端提示词；未登录或请求失败时回退到内置精简提示词（仅含常用低风险工具）
 * @author 鸡哥
 */

import { fetchAgentPrompt } from './mihtnelisAgentStream';

/** 本地 Agent 提示词请求参数 */
export interface LocalAgentPromptRequest {
  /** 登录令牌，可为空 */
  token?: string;
  /** Agent 模式 */
  agentMode: string;
  /** 是否为灵动岛内联快照模式 */
  snapshotMode: boolean;
  /** 工作区目录 */
  workspaces: string[];
  /** 已启用的技能 */
  skills?: Array<{ name: string; content: string }>;
}

/** 本地 Agent 提示词结果 */
export interface LocalAgentPromptResult {
  /** 系统提示词 */
  systemPrompt: string;
  /** 是否来自服务端（内置提示词不应缓存，以便服务端恢复后重新获取） */
  fromServer: boolean;
}

/** 内置提示词可用的工具（均为主进程已实现的本地工具） */
const FALLBACK_TOOL_LINES = [
  '- file.list {path, limit?}：列出目录内容',
  '- file.tree {path, maxDepth?, limit?}：以树形列出目录结构',
  '- file.exists {path}：判断路径是否存在',
  '- file.stat {path}：读取文件或目录信息',
  '- file.read {path}：读取文本文件全部内容',
  '- file.read.lines {path, startLine?, endLine?}：按行读取文本文件',
  '- file.search {path, keyword, limit?}：按文件名搜索',
  '- file.grep {path, pattern, maxDepth?, limit?}：搜索文件内容',
  '- file.write {path, content}：写入（覆盖）文本文件',
  '- file.append {path, content}：向文本文件末尾追加内容',
  '- file.replace {path, search, replacement, replaceAll?}：替换文件中的文本',
  '- file.mkdir {path}：创建目录',
  '- clipboard.read {}：读取剪贴板文本',
  '- clipboard.write {text}：写入剪贴板文本',
  '- sys.info {}：读取操作系统与硬件概况',
  '- monitor.cpu {} / monitor.memory {} / monitor.disk {}：读取 CPU、内存、磁盘使用情况',
  '- win.list {filter?}：列出当前打开的窗口',
  '- notification.send {title?, body}：发送系统通知',
];

/** 单个技能内容在内置提示词中的最大长度 */
const MAX_SKILL_CHARS = 4000;

/**
 * 构建内置精简系统提示词
 * @description 输出协议需与主进程 ReAct 编排器的 JSON 解析保持一致（tool_call / final）
 * @param request - 提示词请求参数
 * @returns 系统提示词文本
 */
export function buildLocalAgentFallbackPrompt(request: LocalAgentPromptRequest): string {
  const workspaceLine = request.workspaces.length > 0
    ? `文件类工具（file.*）只能访问以下工作区目录及其子目录，请使用绝对路径：\n${request.workspaces.map((w) => `- ${w}`).join('\n')}`
    : '当前未配置工作区，文件类工具（file.*）不可用；如用户需要操作文件，请提示其在「设置 → AI」中添加工作区目录。';

  const sections = [
    '你是 eIsland 桌面助手，运行在用户的 Windows 电脑上，可以调用本地工具获取信息或完成操作。',
    [
      '每一轮只能输出一个 JSON 对象，禁止输出任何其他文字：',
      '- 调用工具：{"type":"tool_call","tool":"工具名","purpose":"一句话说明目的","arguments":{...}}',
      '- 最终回答：{"type":"final","answer":"回答内容，可使用 Markdown"}',
    ].join('\n'),
    [
      '规则：',
      '- 一次只调用一个工具，等待「历史观察结果」后再决定下一步；信息足够时立即输出 final。',
      '- 只使用下方列出的工具，不要编造工具名或参数。',
      '- 写入、替换文件前先确认用户确实要求修改。',
      '- 使用与用户相同的语言回答。',
      request.snapshotMode ? '- 当前在灵动岛内联窗口中显示，回答务必简短。' : '',
    ].filter(Boolean).join('\n'),
    workspaceLine,
    `可用工具：\n${FALLBACK_TOOL_LINES.join('\n')}`,
  ];

  const skills = Array.isArray(request.skills) ? request.skills : [];
  if (skills.length > 0) {
    sections.push(`用户启用的技能说明：\n${skills
      .map((s) => `## ${s.name}\n${s.content.slice(0, MAX_SKILL_CHARS)}`)
      .join('\n\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * 获取本地 Agent 系统提示词
 * @description 已登录时先请求服务端；未登录或请求失败时使用内置精简提示词
 * @param request - 提示词请求参数
 * @returns 提示词及其来源
 */
export async function fetchLocalAgentPrompt(request: LocalAgentPromptRequest): Promise<LocalAgentPromptResult> {
  if (request.token?.trim()) {
    try {
      const resp = await fetchAgentPrompt({
        token: request.token,
        agentMode: request.agentMode,
        snapshotMode: request.snapshotMode,
        localMode: true,
        workspaces: request.workspaces.length > 0 ? request.workspaces : undefined,
        skills: Array.isArray(request.skills) && request.skills.length > 0 ? request.skills : undefined,
      });
      if (resp.systemPrompt?.trim()) {
        return { systemPrompt: resp.systemPrompt, fromServer: true };
      }
    } catch (err) {
      console.warn('[LocalAgentPrompt] server prompt unavailable, using built-in prompt:', err);
    }
  }
  return { systemPrompt: buildLocalAgentFallbackPrompt(request), fromServer: false };
}
