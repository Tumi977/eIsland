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
 * @file cliAgentBadges.test.ts
 * @description idle 胶囊 CLI 状态标记的阶段优先级与失联过滤测试。
 * @author 鸡哥
 */

import { describe, expect, it } from 'vitest';
import { buildCliAgentBadges, CLI_BADGE_STALE_MS, resolveCliBadgePhase } from '../cliAgentBadges';

const now = 1_000_000_000;

describe('resolveCliBadgePhase', () => {
  it('returns null without active sessions', () => {
    expect(resolveCliBadgePhase(undefined, now)).toBeNull();
    expect(resolveCliBadgePhase([{ phase: 'completed', lastEventAt: now }, { phase: 'unknown' }], now)).toBeNull();
  });

  it('prefers waiting_permission over running over idle', () => {
    expect(resolveCliBadgePhase([{ phase: 'idle', lastEventAt: now }, { phase: 'running', lastEventAt: now }], now)).toBe('running');
    expect(resolveCliBadgePhase([{ phase: 'running', lastEventAt: now }, { phase: 'waiting_permission', lastEventAt: now }, { phase: 'idle' }], now)).toBe('waiting_permission');
    expect(resolveCliBadgePhase([{ phase: 'idle' }], now)).toBe('idle');
  });

  it('hides sessions without events for longer than the stale window', () => {
    expect(resolveCliBadgePhase([{ phase: 'running', lastEventAt: now - CLI_BADGE_STALE_MS - 1 }], now)).toBeNull();
    expect(resolveCliBadgePhase([{ phase: 'running', lastEventAt: now - CLI_BADGE_STALE_MS }], now)).toBe('running');
  });
});

describe('buildCliAgentBadges', () => {
  it('lists Claude Code before Codex and skips inactive providers', () => {
    expect(buildCliAgentBadges({ claude: 'idle', codex: 'running' })).toEqual([{ provider: 'claude', phase: 'idle' }, { provider: 'codex', phase: 'running' }]);
    expect(buildCliAgentBadges({ claude: null, codex: 'waiting_permission' })).toEqual([{ provider: 'codex', phase: 'waiting_permission' }]);
    expect(buildCliAgentBadges({ claude: null, codex: null })).toEqual([]);
  });
});
