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
 * @file cliAgentBadges.ts
 * @description 根据 Claude Code / Codex 状态快照计算 idle 胶囊上的常驻状态标记。
 * @author 鸡哥
 */

import type { CliProvider } from '../../../../store/types';

/** 标记显示的阶段（completed 不显示） */
export type CliBadgePhase = 'running' | 'waiting_permission' | 'idle';

/** 计算标记所需的最小会话字段 */
export interface CliBadgeSession {
  phase: string;
  lastEventAt?: number;
}

/** 单个 CLI 的状态标记 */
export interface CliAgentBadge {
  provider: CliProvider;
  phase: CliBadgePhase;
}

/** 超过该时长没有新事件的会话视为已失联，不再显示（终端被直接关闭时不会发 SessionEnd） */
export const CLI_BADGE_STALE_MS = 30 * 60 * 1000;

/** 阶段优先级：需要用户处理的排最前 */
const PHASE_PRIORITY: Record<CliBadgePhase, number> = { waiting_permission: 3, running: 2, idle: 1 };

/**
 * 计算单个 CLI 当前最需要关注的阶段
 * @param sessions - 该 CLI 的会话列表
 * @param now - 当前时间戳（毫秒）
 * @returns 最高优先级阶段；无活跃会话时返回 null
 */
export function resolveCliBadgePhase(sessions: CliBadgeSession[] | undefined, now: number): CliBadgePhase | null {
  let best: CliBadgePhase | null = null;
  (sessions ?? []).forEach((session) => {
    const { phase } = session;
    if (phase !== 'running' && phase !== 'waiting_permission' && phase !== 'idle') return;
    if (typeof session.lastEventAt === 'number' && now - session.lastEventAt > CLI_BADGE_STALE_MS) return;
    if (!best || PHASE_PRIORITY[phase] > PHASE_PRIORITY[best]) best = phase;
  });
  return best;
}

/**
 * 汇总所有 CLI 的标记（Claude Code 在前）
 * @param phases - 各 CLI 的阶段
 * @returns 需要显示的标记列表
 */
export function buildCliAgentBadges(phases: Record<CliProvider, CliBadgePhase | null>): CliAgentBadge[] {
  return (['claude', 'codex'] as const)
    .filter((provider) => phases[provider] !== null)
    .map((provider) => ({ provider, phase: phases[provider]! }));
}
