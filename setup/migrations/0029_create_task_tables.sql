-- =====================================================
-- Миграция 0029: Таблицы задач (tasks, task_links, task_events)
-- Дата: 2025-11-14
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------
-- Таблица задач
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',
  creator_id UUID REFERENCES employees(id),
  assignee_id UUID REFERENCES employees(id),
  branch_id UUID REFERENCES branches(id),
  due_at TIMESTAMPTZ,
  snooze_until TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'agent',
  tg_chat_id TEXT,
  tg_topic_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_branch ON tasks(branch_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);

COMMENT ON TABLE tasks IS 'Задачи Jarvis Tasks (агенты, обслуживание, ручные)';
COMMENT ON COLUMN tasks.status IS 'todo | in_progress | blocked | done | cancelled';
COMMENT ON COLUMN tasks.priority IS 'low | normal | high | urgent';
COMMENT ON COLUMN tasks.source IS 'Источник задачи (agent, rentprog, rentprog_history, human, ...)';

-- -----------------------------------------------------
-- Связи задач с сущностями
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS task_links (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_task_links_entity ON task_links(entity_type, entity_id);

COMMENT ON TABLE task_links IS 'Связи задач с сущностями (car, booking, client, branch, employee)';

-- -----------------------------------------------------
-- Журнал событий задач
-- -----------------------------------------------------

CREATE TABLE IF NOT EXISTS task_events (
  id BIGSERIAL PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id);

COMMENT ON TABLE task_events IS 'Журнал событий задачи (создано, назначено, выполнено, snooze, ...)';

-- =====================================================
-- Конец миграции 0029
-- =====================================================

