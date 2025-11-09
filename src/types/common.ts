/**
 * Общие типы для History Processing System
 */

export interface OperationMapping {
  id: number;
  operation_type: string;
  matched_event_type: string | null;
  is_webhook_event: boolean;
  target_table: string | null;
  processing_strategy: string | null;
  field_mappings: Record<string, unknown> | null;
  priority: number;
  enabled: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface HistoryItem {
  id: number;
  ts: Date;
  branch: string;
  operation_type: string | null;
  operation_id: string | null;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  user_name: string | null;
  created_at: Date | null;
  raw_data: Record<string, unknown> | null;
  matched: boolean;
  processed: boolean;
  notes: string | null;
}

export interface ProcessingResult {
  ok: boolean;
  action?: string;
  error?: string;
  details?: Record<string, unknown>;
}

