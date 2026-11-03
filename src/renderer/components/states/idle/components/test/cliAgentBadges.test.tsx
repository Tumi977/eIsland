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
 * @file cliAgentBadges.test.tsx
 * @description CliAgentBadges 渲染（图标、状态点、文案、空状态）测试。
 * @author 鸡哥
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CliAgentBadges } from '../CliAgentBadges';
import { elementProps, elements, resetState } from '../../../../test/elementHarness';
import type { CliAgentBadge } from '../../utils/cliAgentBadges';

const badges = vi.hoisted(() => ({ current: [] as CliAgentBadge[] }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  ...(await import('../../../../test/elementHarness')).hookMocks,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { provider?: string }) => `${key}:${options?.provider ?? ''}` }) }));
vi.mock('../../hooks/useCliAgentBadges', () => ({ useCliAgentBadges: () => badges.current }));

beforeEach(() => {
  resetState();
  badges.current = [];
});

describe('CliAgentBadges', () => {
  it('renders nothing without active sessions', () => {
    expect(CliAgentBadges()).toBeNull();
  });

  it('renders one badge per provider with phase dot and label', () => {
    badges.current = [{ provider: 'claude', phase: 'waiting_permission' }, { provider: 'codex', phase: 'running' }];
    const tree = CliAgentBadges();
    const items = elements(tree).filter((node) => elementProps(node).className === 'idle-cli-badge');
    expect(items.map((node) => elementProps(node)['aria-label'])).toEqual(['idle.cliAgent.waitingPermission:Claude Code', 'idle.cliAgent.running:Codex']);
    const dots = elements(tree).map((node) => String(elementProps(node).className ?? '')).filter((name) => name.startsWith('idle-cli-badge-dot'));
    expect(dots).toEqual(['idle-cli-badge-dot idle-cli-badge-dot--waiting_permission', 'idle-cli-badge-dot idle-cli-badge-dot--running']);
  });

  it('labels a finished turn as idle', () => {
    badges.current = [{ provider: 'claude', phase: 'idle' }];
    const tree = CliAgentBadges();
    expect(elements(tree).some((node) => elementProps(node)['aria-label'] === 'idle.cliAgent.idle:Claude Code')).toBe(true);
  });
});
