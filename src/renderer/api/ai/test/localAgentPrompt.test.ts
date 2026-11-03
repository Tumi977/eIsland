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
 * @file localAgentPrompt.test.ts
 * @description 本地 Agent 提示词获取与内置精简提示词测试
 * @author 鸡哥
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetchAgentPrompt } = vi.hoisted(() => ({ mockFetchAgentPrompt: vi.fn() }));

vi.mock('../mihtnelisAgentStream', () => ({
  fetchAgentPrompt: mockFetchAgentPrompt,
}));

import { buildLocalAgentFallbackPrompt, fetchLocalAgentPrompt } from '../localAgentPrompt';

const base = { agentMode: 'mihtnelis', snapshotMode: false, workspaces: [] as string[] };

beforeEach(() => {
  mockFetchAgentPrompt.mockReset();
});

describe('buildLocalAgentFallbackPrompt', () => {
  it('describes the JSON protocol and asks for a workspace when none is set', () => {
    const prompt = buildLocalAgentFallbackPrompt(base);
    expect(prompt).toContain('"type":"tool_call"');
    expect(prompt).toContain('"type":"final"');
    expect(prompt).toContain('file.read.lines');
    expect(prompt).toContain('当前未配置工作区');
    expect(prompt).not.toContain('回答务必简短');
  });

  it('lists workspaces, snapshot mode and truncated skills', () => {
    const prompt = buildLocalAgentFallbackPrompt({
      ...base,
      snapshotMode: true,
      workspaces: ['C:/work', 'D:/notes'],
      skills: [{ name: 'writer', content: 'x'.repeat(5000) }],
    });
    expect(prompt).toContain('- C:/work\n- D:/notes');
    expect(prompt).toContain('回答务必简短');
    expect(prompt).toContain('## writer');
    expect(prompt).not.toContain('x'.repeat(4001));
  });
});

describe('fetchLocalAgentPrompt', () => {
  it('uses the built-in prompt without calling the server when not logged in', async () => {
    const result = await fetchLocalAgentPrompt({ ...base, token: '  ' });
    expect(mockFetchAgentPrompt).not.toHaveBeenCalled();
    expect(result.fromServer).toBe(false);
    expect(result.systemPrompt).toContain('eIsland');
  });

  it('returns the server prompt and forwards local request options', async () => {
    mockFetchAgentPrompt.mockResolvedValue({ success: true, systemPrompt: 'server prompt' });
    const skills = [{ name: 's', content: 'c' }];
    const result = await fetchLocalAgentPrompt({ ...base, token: 'token', workspaces: ['C:/work'], skills });
    expect(result).toEqual({ systemPrompt: 'server prompt', fromServer: true });
    expect(mockFetchAgentPrompt).toHaveBeenCalledWith({
      token: 'token', agentMode: 'mihtnelis', snapshotMode: false, localMode: true, workspaces: ['C:/work'], skills,
    });
  });

  it.each([
    ['a rejected request', () => mockFetchAgentPrompt.mockRejectedValue(new Error('offline'))],
    ['an empty server prompt', () => mockFetchAgentPrompt.mockResolvedValue({ success: true, systemPrompt: ' ' })],
  ])('falls back to the built-in prompt after %s', async (_label, arrange) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    arrange();
    const result = await fetchLocalAgentPrompt({ ...base, token: 'token' });
    expect(result.fromServer).toBe(false);
    expect(result.systemPrompt).toContain('eIsland');
  });
});
