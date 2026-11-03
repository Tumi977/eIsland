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
 * @file useClaudeCliSessionStatus.ts
 * @description 订阅 Claude Code 与 Codex CLI 状态，检测新会话并追踪活跃状态。
 * @author 鸡哥
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { playNotificationSoundOnce } from '../../utils/audio/notificationSound';
import { readEffectiveAudioVolume } from '../../utils/audio/volume';
import useIslandStore from '../../store/isLandStore';
import type { CliProvider } from '../../store/types';
import { AgentIcon } from '../../utils/SvgIcon';
import { findNewCliCompletion, latestStopEvents } from '../utils/cliTaskCompletion';
import type { CliCompletionEvent } from '../utils/cliTaskCompletion';

interface CliStatusSnapshot {
  sessions: Array<{ id: string; title?: string; phase: string; pendingPermission?: { id: string } | null; events?: CliCompletionEvent[] }>;
  events?: Array<{ id: string; eventName?: string }>;
}

interface ProviderTracker {
  initialized: boolean;
  sessionIds: Set<string>;
  topEventId: string | null;
  permissionIds: Set<string>;
  /** 各会话最新的本轮结束事件 ID，用于识别新完成的任务 */
  stopEventIds: Map<string, string>;
}

const createProviderTracker = (): ProviderTracker => ({
  initialized: false,
  sessionIds: new Set(),
  topEventId: null,
  permissionIds: new Set(),
  stopEventIds: new Map(),
});

/**
 * @description 以 ref 形式追踪 Claude Code 与 Codex 是否存在活跃会话，不触发组件重渲染。
 * @returns 包含 hasActiveSessionRef 的对象，可在事件回调中同步读取。
 */
export function useClaudeCliSessionStatus(): {
  hasActiveSessionRef: React.MutableRefObject<boolean>;
} {
  const { t } = useTranslation();
  const hasActiveSessionRef = useRef(false);
  const activeByProviderRef = useRef<Record<CliProvider, boolean>>({ claude: false, codex: false });
  const trackersRef = useRef<Record<CliProvider, ProviderTracker>>({
    claude: createProviderTracker(),
    codex: createProviderTracker(),
  });

  useEffect(() => {
    let cancelled = false;

    const applySnapshot = (provider: CliProvider, snapshot: CliStatusSnapshot | null | undefined): void => {
      if (cancelled || !snapshot) return;
      const tracker = trackersRef.current[provider];
      const sessionIds = new Set(snapshot.sessions.map((session) => session.id));
      activeByProviderRef.current[provider] = snapshot.sessions.some((session) => session.phase !== 'completed');
      hasActiveSessionRef.current = Object.values(activeByProviderRef.current).some(Boolean);

      const pendingIds = new Set<string>(
        snapshot.sessions
          .filter((session) => session.phase === 'waiting_permission' && session.pendingPermission?.id)
          .map((session) => session.pendingPermission!.id),
      );
      const topEvent = snapshot.events?.[0];
      const topEventId = topEvent?.id ?? null;
      const isSessionStartEvent = /^sessionstart$/i.test(topEvent?.eventName ?? '');
      const hasNewSessionId = [...sessionIds].some((id) => !tracker.sessionIds.has(id));

      if (tracker.initialized) {
        const raisedPermission = [...pendingIds].some((id) => {
          if (tracker.permissionIds.has(id)) return false;
          playNotificationSoundOnce();
          const store = useIslandStore.getState();
          const launcherVisible = store.maxExpandAppModeEnabled && store.maxExpandLauncherVisible;
          const inCliView = store.state === 'cli' || (store.state === 'maxExpand' && !launcherVisible && store.maxExpandTab === 'cli');
          if (!inCliView) {
            store.setCliProvider(provider);
            store.setCli();
          }
          return true;
        });

        const hasNewSessionStart = Boolean(topEventId && topEventId !== tracker.topEventId && isSessionStartEvent);
        const raisedSessionNotice = hasNewSessionId || hasNewSessionStart;
        if (raisedSessionNotice) {
          const store = useIslandStore.getState();
          const launcherVisible = store.maxExpandAppModeEnabled && store.maxExpandLauncherVisible;
          const inCliView = store.state === 'cli' || (store.state === 'maxExpand' && !launcherVisible && store.maxExpandTab === 'cli');
          if (!inCliView) {
            void (async () => {
              const targetVolume = await readEffectiveAudioVolume('effect').catch(() => 1);
              const triggerSound = new Audio('../audio/AGENT.wav');
              triggerSound.volume = targetVolume;
              void triggerSound.play().catch(() => {
                triggerSound.src = './public/audio/AGENT.wav';
                triggerSound.volume = targetVolume;
                void triggerSound.play().catch(() => {});
              });
            })();
            void window.api?.cliGlowShow?.();
            store.setNotification({
              title: provider === 'codex' ? 'Codex' : 'Claude Code',
              body: t('notification.cliSessionDetected.body', {
                provider: provider === 'codex' ? 'Codex' : 'Claude Code',
              }),
              icon: provider === 'codex' ? AgentIcon.CODEX : AgentIcon.CLAUDE_KB,
              type: 'cli-session-detected',
              cliProvider: provider,
            });
          }
        }

        // 每轮任务完成都放大提醒一次（同一会话继续对话也会提醒），并带上最后一段回复
        const completion = findNewCliCompletion(snapshot.sessions, tracker.stopEventIds, Date.now());
        if (completion && !raisedPermission && !raisedSessionNotice) {
          const store = useIslandStore.getState();
          const launcherVisible = store.maxExpandAppModeEnabled && store.maxExpandLauncherVisible;
          const inCliView = store.state === 'cli' || (store.state === 'maxExpand' && !launcherVisible && store.maxExpandTab === 'cli');
          if (!inCliView) {
            const providerName = provider === 'codex' ? 'Codex' : 'Claude Code';
            playNotificationSoundOnce();
            store.setNotification({
              title: completion.failed
                ? t('notification.cliTaskCompleted.failedTitle', { defaultValue: '{{provider}} 任务异常结束', provider: providerName })
                : t('notification.cliTaskCompleted.title', { defaultValue: '{{provider}} 任务完成', provider: providerName }),
              body: completion.report
                ? `${completion.sessionTitle}：${completion.report}`
                : t('notification.cliTaskCompleted.emptyBody', { defaultValue: '{{session}} 本轮任务已结束，切换到 CLI 面板查看报告', session: completion.sessionTitle }),
              icon: provider === 'codex' ? AgentIcon.CODEX : AgentIcon.CLAUDE_KB,
              type: 'cli-session-detected',
              cliProvider: provider,
            });
          }
        }
      }

      tracker.stopEventIds = new Map([...latestStopEvents(snapshot.sessions)].map(([sessionId, event]) => [sessionId, event.id]));
      tracker.initialized = true;
      tracker.sessionIds = sessionIds;
      tracker.permissionIds = pendingIds;
      tracker.topEventId = topEventId;
    };

    const applyClaudeSnapshot = (snapshot: CliStatusSnapshot | null | undefined): void => applySnapshot('claude', snapshot);
    const applyCodexSnapshot = (snapshot: CliStatusSnapshot | null | undefined): void => applySnapshot('codex', snapshot);

    window.api?.claudeCodeStatusGet?.().then(applyClaudeSnapshot).catch(() => {});
    window.api?.codexStatusGet?.().then(applyCodexSnapshot).catch(() => {});
    const unsubscribeClaude = window.api?.onClaudeCodeStatusUpdated?.(applyClaudeSnapshot);
    const unsubscribeCodex = window.api?.onCodexStatusUpdated?.(applyCodexSnapshot);

    return () => {
      cancelled = true;
      unsubscribeClaude?.();
      unsubscribeCodex?.();
    };
  }, [t]);

  return { hasActiveSessionRef };
}
