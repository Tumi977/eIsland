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
 * @file cliTaskCompletion.test.ts
 * @description CLI 本轮任务完成识别（去重、时效、报告截断）测试。
 * @author 鸡哥
 */

import { describe, expect, it } from 'vitest';
import { CLI_COMPLETION_FRESH_MS, findNewCliCompletion, latestStopEvents } from '../cliTaskCompletion';

const now = 2_000_000_000;

describe('latestStopEvents', () => {
  it('keeps only the newest Stop / StopFailure event per session', () => {
    const latest = latestStopEvents([
      { id: 'a', events: [{ id: 'tool', eventName: 'PreToolUse', createdAt: now }, { id: 's1', eventName: 'Stop', createdAt: now - 10 }, { id: 's2', eventName: 'StopFailure', createdAt: now - 5 }] },
      { id: 'b', events: [{ id: 'msg', eventName: 'AssistantOutput', createdAt: now }] },
    ]);
    expect([...latest.entries()].map(([sessionId, event]) => [sessionId, event.id])).toEqual([['a', 's2']]);
  });
});

describe('findNewCliCompletion', () => {
  it('returns the newest unseen fresh completion with a one-line report', () => {
    const result = findNewCliCompletion([
      { id: 'a', title: 'repo-a', events: [{ id: 'a1', eventName: 'Stop', createdAt: now - 100, summary: 'older' }] },
      { id: 'b', title: ' ', events: [{ id: 'b1', eventName: 'Stop', createdAt: now - 10, summary: 'line one\n\n  line two' }] },
    ], new Map(), now);
    expect(result).toEqual({ sessionId: 'b', sessionTitle: 'b', eventId: 'b1', failed: false, report: 'line one line two' });
  });

  it('ignores seen, stale and timestamp-less events', () => {
    const sessions = [
      { id: 'seen', events: [{ id: 'x', eventName: 'Stop', createdAt: now }] },
      { id: 'stale', events: [{ id: 'y', eventName: 'Stop', createdAt: now - CLI_COMPLETION_FRESH_MS - 1 }] },
      { id: 'no-time', events: [{ id: 'z', eventName: 'Stop' }] },
    ];
    expect(findNewCliCompletion(sessions, new Map([['seen', 'x']]), now)).toBeNull();
    expect(findNewCliCompletion(undefined, new Map(), now)).toBeNull();
  });

  it('marks failures, drops placeholder summaries and truncates long reports', () => {
    expect(findNewCliCompletion([{ id: 'a', events: [{ id: 'f', eventName: 'StopFailure', createdAt: now, summary: '本轮异常结束' }] }], new Map(), now))
      .toMatchObject({ failed: true, report: '' });
    const long = findNewCliCompletion([{ id: 'a', events: [{ id: 'l', eventName: 'Stop', createdAt: now, summary: 'x'.repeat(500) }] }], new Map(), now);
    expect(long?.report).toBe(`${'x'.repeat(160)}…`);
  });
});
