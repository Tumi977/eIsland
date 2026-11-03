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
 * @file islandMinimizeButton.test.ts
 * @description IslandMinimizeButton 显示范围与点击收回 idle 测试。
 * @author 鸡哥
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IslandMinimizeButton } from '../IslandMinimizeButton';
import { elementProps, findElement, invoke, resetState } from '../../test/elementHarness';
import type { IslandState } from '../../../store/types';

const store = vi.hoisted(() => ({ setIdle: vi.fn() }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  ...(await import('../../test/elementHarness')).hookMocks,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../store/isLandStore', () => ({ default: (selector: (state: typeof store) => unknown) => selector(store) }));

beforeEach(() => {
  vi.clearAllMocks();
  resetState();
});

describe('IslandMinimizeButton', () => {
  it.each(['expanded', 'maxExpand'] as const)('collapses %s to idle without bubbling to the shell', (state) => {
    const tree = IslandMinimizeButton({ state });
    expect(tree).not.toBeNull();
    expect(elementProps(tree)['aria-label']).toBe('common.minimizeIsland');
    const event = { stopPropagation: vi.fn() };
    invoke(findElement(tree, (node) => node.type === 'button'), 'onClick', event);
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(store.setIdle).toHaveBeenCalledWith(true);
  });

  it.each(['idle', 'hover', 'notification', 'cli', 'agent', 'lyrics'] as IslandState[])('is hidden in %s', (state) => {
    expect(IslandMinimizeButton({ state })).toBeNull();
  });
});
