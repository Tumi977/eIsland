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
 * @file IslandMinimizeButton.tsx
 * @description 灵动岛右上角最小化按钮：展开 / 最大展开时一键收回 idle 胶囊（不隐藏到托盘）。
 * @author 鸡哥
 */

import type { JSX, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../store/isLandStore';
import type { IslandState } from '../../store/types';

/** 显示最小化按钮的状态 */
const MINIMIZABLE_STATES: ReadonlySet<IslandState> = new Set<IslandState>(['expanded', 'maxExpand']);

interface IslandMinimizeButtonProps {
  /** 当前灵动岛状态 */
  state: IslandState;
}

/**
 * @description 渲染最小化按钮；仅在展开类状态显示。
 * @param props - 当前灵动岛状态。
 * @returns 按钮节点；其他状态返回 null。
 */
export function IslandMinimizeButton({ state }: IslandMinimizeButtonProps): JSX.Element | null {
  const { t } = useTranslation();
  const setIdle = useIslandStore((s) => s.setIdle);

  if (!MINIMIZABLE_STATES.has(state)) return null;

  const label = t('common.minimizeIsland', { defaultValue: '最小化灵动岛' });

  /** 阻止冒泡到外壳点击（否则会切到 hover），并强制收回 idle */
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    setIdle(true);
  };

  return (
    <button
      type="button"
      className="island-minimize-btn"
      title={label}
      aria-label={label}
      onClick={handleClick}
    >
      <svg width="10" height="2" viewBox="0 0 10 2" aria-hidden="true">
        <rect width="10" height="1.6" rx="0.8" fill="currentColor" />
      </svg>
    </button>
  );
}
