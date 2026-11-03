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
 * @file CliAgentBadges.tsx
 * @description idle 胶囊上的 Claude Code / Codex 常驻工作状态标记。
 * @author 鸡哥
 */

import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AgentIcon } from '../../../../utils/SvgIcon';
import { useCliAgentBadges } from '../hooks/useCliAgentBadges';
import type { CliBadgePhase } from '../utils/cliAgentBadges';

const PROVIDER_LABELS = { claude: 'Claude Code', codex: 'Codex' } as const;
const PROVIDER_ICONS = { claude: AgentIcon.CLAUDE_KB, codex: AgentIcon.CODEX } as const;

/**
 * 生成标记的无障碍文案
 * @param t - 翻译函数
 * @param phase - 标记阶段
 * @param provider - CLI 显示名
 * @returns 文案
 */
function phaseLabel(t: TFunction, phase: CliBadgePhase, provider: string): string {
  if (phase === 'waiting_permission') return t('idle.cliAgent.waitingPermission', { defaultValue: '{{provider}} 等待授权', provider });
  if (phase === 'running') return t('idle.cliAgent.running', { defaultValue: '{{provider}} 运行中', provider });
  return t('idle.cliAgent.idle', { defaultValue: '{{provider}} 本轮已完成', provider });
}

/**
 * 渲染 CLI 状态标记；没有活跃会话时不占位
 * @returns 标记节点或 null
 */
export function CliAgentBadges(): ReactElement | null {
  const { t } = useTranslation();
  const badges = useCliAgentBadges();
  if (badges.length === 0) return null;

  return (
    <div className="idle-cli-badges">
      {badges.map(({ provider, phase }) => {
        const label = phaseLabel(t, phase, PROVIDER_LABELS[provider]);
        return (
          <span key={provider} className="idle-cli-badge" title={label} aria-label={label} role="img">
            <img className="idle-cli-badge-icon" src={PROVIDER_ICONS[provider]} alt="" draggable={false} />
            <span className={`idle-cli-badge-dot idle-cli-badge-dot--${phase}`} />
          </span>
        );
      })}
    </div>
  );
}
