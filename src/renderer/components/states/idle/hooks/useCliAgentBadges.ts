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
 * @file useCliAgentBadges.ts
 * @description 订阅 Claude Code / Codex 状态，供 idle 胶囊常驻显示工作状态。
 * @author 鸡哥
 */

import { useEffect, useMemo, useState } from 'react';
import type { CliProvider } from '../../../../store/types';
import { buildCliAgentBadges, resolveCliBadgePhase } from '../utils/cliAgentBadges';
import type { CliAgentBadge, CliBadgeSession } from '../utils/cliAgentBadges';

/** 失联判断的重新计算周期 */
const STALE_RECHECK_MS = 60 * 1000;

interface CliBadgeSnapshot {
  sessions?: CliBadgeSession[];
}

/**
 * 订阅两个 CLI 的状态快照并计算标记
 * @returns 当前需要显示的标记列表
 */
export function useCliAgentBadges(): CliAgentBadge[] {
  const [sessions, setSessions] = useState<Record<CliProvider, CliBadgeSession[]>>({ claude: [], codex: [] });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const apply = (provider: CliProvider) => (snapshot: CliBadgeSnapshot | null | undefined): void => {
      if (cancelled || !snapshot) return;
      setSessions((prev) => ({ ...prev, [provider]: Array.isArray(snapshot.sessions) ? snapshot.sessions : [] }));
      setNow(Date.now());
    };
    const applyClaude = apply('claude');
    const applyCodex = apply('codex');
    window.api?.claudeCodeStatusGet?.().then(applyClaude).catch(() => {});
    window.api?.codexStatusGet?.().then(applyCodex).catch(() => {});
    const unsubscribeClaude = window.api?.onClaudeCodeStatusUpdated?.(applyClaude);
    const unsubscribeCodex = window.api?.onCodexStatusUpdated?.(applyCodex);
    const timer = setInterval(() => setNow(Date.now()), STALE_RECHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      unsubscribeClaude?.();
      unsubscribeCodex?.();
    };
  }, []);

  return useMemo(() => buildCliAgentBadges({
    claude: resolveCliBadgePhase(sessions.claude, now),
    codex: resolveCliBadgePhase(sessions.codex, now),
  }), [sessions, now]);
}
