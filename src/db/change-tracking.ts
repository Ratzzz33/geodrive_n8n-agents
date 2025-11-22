/**
 * Утилиты для отслеживания источника изменений в БД
 */

export type ChangeSource = 
  | 'rentprog_webhook'
  | 'rentprog_history'
  | 'snapshot_workflow'
  | 'jarvis_api'
  | 'manual'
  | 'n8n_workflow'
  | 'trigger'
  | 'migration'
  | 'script';

export interface ChangeTrackingInfo {
  source: ChangeSource;
  workflow?: string; // ID или название workflow
  function?: string; // Название функции/метода
  executionId?: string; // ID execution в n8n
  user?: string; // Пользователь
  metadata?: Record<string, any>; // Дополнительные метаданные
}

/**
 * Создает объект с информацией об источнике изменения для сохранения в БД
 */
export function createChangeTrackingInfo(info: ChangeTrackingInfo) {
  return {
    updated_by_source: info.source,
    updated_by_workflow: info.workflow || null,
    updated_by_function: info.function || null,
    updated_by_execution_id: info.executionId || null,
    updated_by_user: info.user || null,
    updated_by_metadata: info.metadata || null,
  };
}

/**
 * Определяет источник изменения из контекста запроса
 */
export function detectChangeSource(context?: {
  workflowId?: string;
  workflowName?: string;
  executionId?: string;
  userId?: string;
  source?: ChangeSource;
}): ChangeTrackingInfo {
  if (context?.source) {
    return {
      source: context.source,
      workflow: context.workflowName || context.workflowId,
      executionId: context.executionId,
      user: context.userId,
    };
  }

  // Автоматическое определение по контексту
  if (context?.workflowId || context?.workflowName) {
    return {
      source: 'n8n_workflow',
      workflow: context.workflowName || context.workflowId,
      executionId: context.executionId,
      user: context.userId,
    };
  }

  // По умолчанию - jarvis_api
  return {
    source: 'jarvis_api',
    function: 'upsertCarFromRentProg', // будет переопределено в функции
    executionId: context?.executionId,
    user: context?.userId,
  };
}

/**
 * Извлекает информацию об источнике из HTTP запроса (для API endpoints)
 */
export function extractChangeSourceFromRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, any>;
}): ChangeTrackingInfo {
  const workflowId = req.headers?.['x-workflow-id'] as string | undefined;
  const workflowName = req.headers?.['x-workflow-name'] as string | undefined;
  const executionId = req.headers?.['x-execution-id'] as string | undefined;
  const userId = req.headers?.['x-user-id'] as string | undefined;
  const source = req.body?.source as ChangeSource | undefined;

  return detectChangeSource({
    workflowId,
    workflowName,
    executionId,
    userId,
    source,
  });
}

