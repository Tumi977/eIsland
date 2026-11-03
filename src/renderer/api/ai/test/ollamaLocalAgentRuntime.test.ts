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
 * @file ollamaLocalAgentRuntime.test.ts
 * @description Ollama Agent 真实提示词网络、缓存、IPC 事件和取消边界测试。
 * @author 鸡哥
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OllamaLocalAgentRequest } from '../types/OllamaLocalAgentRequest';

interface Event { type: string; payload: Record<string, unknown> }
const token = `header.${  Buffer.from(JSON.stringify({ role: 'pro' })).toString('base64url')  }.sig`;
const base: OllamaLocalAgentRequest = { token, message: ' hello ', model: 'model' };
const fetchMock = vi.fn<typeof fetch>();
const unsubscribe = vi.fn();
const abort = vi.fn<(id: string) => Promise<void>>();
const start = vi.fn<(id: string, params: Record<string, unknown>) => Promise<void>>();
let listener: (event: Event) => void;
let stream: typeof import('../ollamaLocalAgent').streamOllamaLocalAgent;
let clearCache: typeof import('../ollamaLocalAgent').clearOllamaPromptCache;

beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks();
  listener = () => { throw new Error('IPC listener not registered'); };
  fetchMock.mockImplementation(() => Promise.resolve(Response.json({ success: true, systemPrompt: 'Prompt' })));
  abort.mockResolvedValue();
  start.mockImplementation(() => { listener({ type: 'final', payload: { text: 'Done' } }); return Promise.resolve(); });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null) });
  vi.stubGlobal('window', { location: { hostname: 'eisland.local' }, api: {
    updaterVersion: vi.fn().mockResolvedValue('1.2.3'),
    onOllamaChatEvent: (id: string, callback: (event: Event) => void) => { expect(id).toMatch(/^(ollama|custom-direct)-/); listener = callback; return unsubscribe; },
    ollamaChatStart: start, ollamaChatAbort: abort,
  } });
  const module = await import('../ollamaLocalAgent'); stream = module.streamOllamaLocalAgent; clearCache = module.clearOllamaPromptCache;
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('ollamaLocalAgent real prompt and IPC boundary', () => {
  it.each([{ message: '' }, { message: undefined }])('rejects missing public request values %j', async (patch) => {
    await expect(stream({ ...base, ...patch } as OllamaLocalAgentRequest)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled(); expect(start).not.toHaveBeenCalled();
  });
  it.each([{ token: '' }, { token: undefined }])('starts without login using the built-in prompt %j', async (patch) => {
    await stream({ ...base, ...patch } as OllamaLocalAgentRequest);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(start.mock.calls[0][1]).toMatchObject({ token: '', systemPrompt: expect.stringContaining('eIsland') });
  });
  it.each(['invalid', 'header.@@@.sig', `header.${  Buffer.from('null').toString('base64url')  }.sig`, `header.${  Buffer.from('{}').toString('base64url')  }.sig`, `header.${  Buffer.from('{"role":123}').toString('base64url')  }.sig`])('accepts malformed or non-pro roles %s', async (otherToken) => {
    await stream({ ...base, token: otherToken }); expect(start).toHaveBeenCalledTimes(1);
  });
  it('accepts a bearer token with a normalized pro role', async () => {
    const normalized = `header.${  Buffer.from('{"role":" PRO "}').toString('base64url')  }.sig`;
    await stream({ ...base, token: ` Bearer ${  normalized  } ` }); expect(start).toHaveBeenCalledTimes(1);
  });
  it('requests the real prompt and sends trimmed user input to IPC', async () => {
    await stream(base);
    expect(fetchMock.mock.calls[0][0]).toContain('/agent/prompt');
    expect(start.mock.calls[0][1]).toMatchObject({ userMessage: 'hello', systemPrompt: 'Prompt' });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('reuses equivalent cache keys then invalidates a changed or explicitly cleared prompt', async () => {
    const first = { ...base, workspaces: ['b', 'a'], skills: [{ name: 'two', content: '2' }, { name: 'one', content: '1' }], snapshotMode: true, agentMode: 'custom-mode' };
    await stream(first);
    await stream({ ...first, workspaces: ['a', 'b'], skills: first.skills.toReversed() });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await stream({ ...first, snapshotMode: false }); expect(fetchMock).toHaveBeenCalledTimes(2);
    clearCache(); await stream(base); expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('refetches an empty cached prompt and handles empty arrays', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ success: true, systemPrompt: '' })));
    await stream({ ...base, workspaces: [], skills: [] }); await stream({ ...base, workspaces: [], skills: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([true, false])('maps all intermediate events with callback enabled=%s', async (enabled) => {
    const onEvent = vi.fn();
    const types = ['chunk', 'tool_call_request', 'tool_call_result', 'think', 'stream_rollback', 'meta', 'todo'];
    start.mockImplementation(() => { types.forEach((type) => listener({ type, payload: { text: 'data', thinkingEnabled: true } })); listener({ type: 'final', payload: {} }); return Promise.resolve(); });
    await stream({ ...base, onEvent: enabled ? onEvent : undefined });
    if (enabled) {
      expect(onEvent.mock.calls.map(([event]) => (event as Event).type)).toEqual([...types, 'final']);
      expect(onEvent).toHaveBeenCalledWith({ type: 'meta', payload: { text: 'data', thinkingEnabled: true } });
      expect(onEvent).toHaveBeenCalledWith({ type: 'chunk', payload: { text: 'data' } });
    }
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])('completes an error terminal event with callback enabled=%s', async (enabled) => {
    const onEvent = vi.fn(); start.mockImplementation(() => { listener({ type: 'error', payload: { message: 'Failed' } }); return Promise.resolve(); });
    await stream({ ...base, onEvent: enabled ? onEvent : undefined });
    if (enabled) expect(onEvent).toHaveBeenCalledWith({ type: 'error', payload: { message: 'Failed' } });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it.each([new Error('offline'), 'offline'])('falls back to the built-in prompt on prompt transport rejection %s', async (error) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(error);const onEvent = vi.fn(); await stream({ onEvent, ...base });
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(start.mock.calls[0][1]).toMatchObject({ systemPrompt: expect.stringContaining('eIsland') });
  });
  it.each([new Error('offline'), 'offline'])('reports IPC start rejection %s', async (error) => {
    start.mockRejectedValue(error);const onEvent = vi.fn();await stream({ onEvent, ...base });
    expect(onEvent).toHaveBeenCalledWith({ type: 'error', payload: { code: 'IPC_START_FAILED', message: '启动本地 Agent 失败: offline' } });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('contains IPC failure without an event callback', async () => {
    start.mockRejectedValue(new Error('offline'));await stream(base);expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])('completes cancellation when abort IPC fails=%s', async (failed) => {
    const controller = new AbortController(); if (failed) abort.mockRejectedValue(new Error('offline'));
    start.mockImplementation(() => { controller.abort(); return Promise.resolve(); });
    await stream({ ...base, signal: controller.signal });
    expect(abort).toHaveBeenCalledWith(start.mock.calls[0][0]);expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
