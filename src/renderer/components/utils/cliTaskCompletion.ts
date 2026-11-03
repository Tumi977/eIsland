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
 * @file cliTaskCompletion.ts
 * @description 从 Claude Code / Codex 状态快照中找出"新完成的一轮任务"，用于灵动岛完成提醒。
 * @author 鸡哥
 */

/** 判断所需的最小事件字段 */
export interface CliCompletionEvent {
  id: string;
  eventName?: string;
  createdAt?: number;
  summary?: string;
}

/** 判断所需的最小会话字段 */
export interface CliCompletionSession {
  id: string;
  title?: string;
  events?: CliCompletionEvent[];
}

/** 一轮任务完成的信息 */
export interface CliTaskCompletion {
  sessionId: string;
  sessionTitle: string;
  eventId: string;
  /** 本轮是否异常结束 */
  failed: boolean;
  /** 最后一段回复（已压成单行并截断） */
  report: string;
}

/** 只提醒这段时间内发生的完成事件，避免重新扫描日志时把旧事件当成新完成 */
export const CLI_COMPLETION_FRESH_MS = 2 * 60 * 1000;

/** 报告在通知中的最大长度 */
const MAX_REPORT_CHARS = 160;

/** 本轮结束事件（Claude Code hook 与 Codex 日志解析都使用这两个事件名） */
const STOP_EVENT_NAMES = new Set(['Stop', 'StopFailure']);

/** 占位摘要不算报告 */
const PLACEHOLDER_SUMMARIES = new Set(['本轮完成', '本轮异常结束']);

/**
 * 取每个会话最新的本轮结束事件
 * @param sessions - 会话列表
 * @returns 会话 ID → 最新结束事件
 */
export function latestStopEvents(sessions: CliCompletionSession[] | undefined): Map<string, CliCompletionEvent> {
  const result = new Map<string, CliCompletionEvent>();
  (sessions ?? []).forEach((session) => {
    (session.events ?? []).forEach((event) => {
      if (!STOP_EVENT_NAMES.has(event.eventName ?? '')) return;
      const current = result.get(session.id);
      if (!current || (event.createdAt ?? 0) > (current.createdAt ?? 0)) result.set(session.id, event);
    });
  });
  return result;
}

/**
 * 压缩报告文本
 * @param summary - 事件摘要
 * @returns 单行报告；没有内容时为空串
 */
function toReport(summary: string | undefined): string {
  const text = (summary ?? '').replace(/\s+/g, ' ').trim();
  if (!text || PLACEHOLDER_SUMMARIES.has(text)) return '';
  return text.length > MAX_REPORT_CHARS ? `${text.slice(0, MAX_REPORT_CHARS)}…` : text;
}

/**
 * 找出相对上次快照新出现的、最近的一次任务完成
 * @param sessions - 本次快照的会话列表
 * @param seen - 上次快照中各会话最新结束事件的 ID
 * @param now - 当前时间戳（毫秒）
 * @returns 最新的一次完成；没有时返回 null
 */
export function findNewCliCompletion(
  sessions: CliCompletionSession[] | undefined,
  seen: Map<string, string>,
  now: number,
): CliTaskCompletion | null {
  const latest = latestStopEvents(sessions);
  let best: { session: CliCompletionSession; event: CliCompletionEvent } | null = null;
  for (const session of sessions ?? []) {
    const event = latest.get(session.id);
    if (!event || seen.get(session.id) === event.id) continue;
    if (typeof event.createdAt !== 'number' || now - event.createdAt > CLI_COMPLETION_FRESH_MS) continue;
    if (!best || event.createdAt > (best.event.createdAt ?? 0)) best = { session, event };
  }
  if (!best) return null;
  const { session, event } = best;
  return {
    sessionId: session.id,
    sessionTitle: session.title?.trim() || session.id,
    eventId: event.id,
    failed: event.eventName === 'StopFailure',
    report: toReport(event.summary),
  };
}
