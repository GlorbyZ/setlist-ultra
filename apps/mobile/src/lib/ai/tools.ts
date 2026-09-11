/** Typed tool registry. The model may request reads; apply/undo stay app-controlled. */

export type ToolStatus =
  | 'ok'
  | 'not_found'
  | 'forbidden'
  | 'validation_failed'
  | 'conflict'
  | 'retryable_error'
  | 'cancelled';

export type ToolType = 'read' | 'sensitive_read' | 'proposal' | 'validation' | 'write';
export type ToolRisk = 'low' | 'medium' | 'high';

export type AiToolName =
  | 'library.search'
  | 'songs.get'
  | 'charts.get'
  | 'sets.get'
  | 'library.readiness'
  | 'sets.propose'
  | 'charts.proposePatch'
  | 'metadata.proposePatch'
  | 'proposals.validate'
  | 'proposals.apply'
  | 'operations.undo';

export type AiToolDef = {
  name: AiToolName;
  type: ToolType;
  risk: ToolRisk;
  /** False = musician/app only. The model must not execute these. */
  modelCallable: boolean;
};

export const AI_TOOLS: readonly AiToolDef[] = [
  { name: 'library.search', type: 'read', risk: 'low', modelCallable: true },
  { name: 'songs.get', type: 'read', risk: 'low', modelCallable: true },
  { name: 'charts.get', type: 'sensitive_read', risk: 'medium', modelCallable: false },
  { name: 'sets.get', type: 'read', risk: 'low', modelCallable: true },
  { name: 'library.readiness', type: 'read', risk: 'low', modelCallable: true },
  { name: 'sets.propose', type: 'proposal', risk: 'medium', modelCallable: true },
  { name: 'charts.proposePatch', type: 'proposal', risk: 'medium', modelCallable: true },
  { name: 'metadata.proposePatch', type: 'proposal', risk: 'medium', modelCallable: true },
  { name: 'proposals.validate', type: 'validation', risk: 'low', modelCallable: true },
  { name: 'proposals.apply', type: 'write', risk: 'high', modelCallable: false },
  { name: 'operations.undo', type: 'write', risk: 'high', modelCallable: false },
] as const;

export function getAiTool(name: string): AiToolDef | undefined {
  return AI_TOOLS.find((tool) => tool.name === name);
}

export function modelMayCallTool(name: string): boolean {
  return getAiTool(name)?.modelCallable === true;
}

export type ToolResult<T = unknown> = {
  status: ToolStatus;
  tool: string;
  data?: T;
  error?: string;
};

export function toolForbidden(name: string): ToolResult {
  return { status: 'forbidden', tool: name, error: 'This action is app-controlled and needs a musician tap.' };
}

export function assertWriteIsAppControlled(name: AiToolName): ToolResult | null {
  const tool = getAiTool(name);
  if (!tool) return { status: 'not_found', tool: name, error: 'Unknown tool.' };
  if (!tool.modelCallable) return null;
  return null;
}
