/**
 * Сервис для работы с системой задач (Jarvis Tasks)
 * Создание, обновление и закрытие задач
 */

import postgres from 'postgres';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const sql = postgres(CONNECTION_STRING, { max: 10, ssl: { rejectUnauthorized: false } });

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  creator_id: string | null;
  assignee_id: string | null;
  branch_id: string | null;
  due_at: Date | null;
  snooze_until: Date | null;
  source: 'jarvis' | 'agent' | 'rentprog' | 'human';
  tg_chat_id: string | null;
  tg_topic_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  status?: Task['status'];
  priority?: Task['priority'];
  creator_id?: string;
  assignee_id?: string;
  branch_id?: string;
  due_at?: Date;
  source?: Task['source'];
}

export interface TaskLink {
  task_id: string;
  entity_type: 'car' | 'booking' | 'client' | 'employee' | 'branch';
  entity_id: string;
}

/**
 * Создать задачу
 */
export async function createTask(params: CreateTaskParams): Promise<Task> {
  const {
    title,
    description = '',
    status = 'todo',
    priority = 'normal',
    creator_id,
    assignee_id,
    branch_id,
    due_at,
    source = 'agent',
  } = params;

  const result = await sql`
    INSERT INTO tasks (
      title, description, status, priority,
      creator_id, assignee_id, branch_id, due_at, source
    )
    VALUES (
      ${title}, ${description}, ${status}, ${priority},
      ${creator_id || null}, ${assignee_id || null}, ${branch_id || null}, ${due_at || null}, ${source}
    )
    RETURNING *
  `;

  console.log(`✅ Created task: ${title} (${result[0].id})`);

  return result[0] as Task;
}

/**
 * Обновить статус задачи
 */
export async function updateTaskStatus(
  taskId: string,
  status: Task['status']
): Promise<void> {
  await sql`
    UPDATE tasks
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${taskId}
  `;

  console.log(`✅ Updated task ${taskId}: status → ${status}`);
}

/**
 * Связать задачу с сущностью
 */
export async function linkTaskToEntity(
  taskId: string,
  entityType: TaskLink['entity_type'],
  entityId: string
): Promise<void> {
  await sql`
    INSERT INTO task_links (task_id, entity_type, entity_id)
    VALUES (${taskId}, ${entityType}, ${entityId})
    ON CONFLICT DO NOTHING
  `;

  console.log(`✅ Linked task ${taskId} to ${entityType} ${entityId}`);
}

/**
 * Найти задачу по external_ref (например, serviceId из RentProg)
 */
export async function findTaskByExternalRef(
  system: string,
  externalId: string
): Promise<Task | null> {
  // Ищем задачу через external_refs с entity_type='task'
  const result = await sql`
    SELECT t.*
    FROM tasks t
    JOIN external_refs er ON er.entity_id = t.id
    WHERE er.system = ${system}
      AND er.external_id = ${externalId}
      AND er.entity_type = 'task'
  `;

  if (result.length === 0) {
    return null;
  }

  return result[0] as Task;
}

/**
 * Создать external_ref для задачи
 */
export async function createTaskExternalRef(
  taskId: string,
  system: string,
  externalId: string
): Promise<void> {
  await sql`
    INSERT INTO external_refs (entity_type, entity_id, system, external_id)
    VALUES ('task', ${taskId}, ${system}, ${externalId})
    ON CONFLICT (system, external_id) DO NOTHING
  `;

  console.log(`✅ Created external_ref: task ${taskId} ↔ ${system}:${externalId}`);
}

/**
 * Получить задачи по сущности
 */
export async function getTasksByEntity(
  entityType: TaskLink['entity_type'],
  entityId: string
): Promise<Task[]> {
  const result = await sql`
    SELECT t.*
    FROM tasks t
    JOIN task_links tl ON tl.task_id = t.id
    WHERE tl.entity_type = ${entityType}
      AND tl.entity_id = ${entityId}
    ORDER BY t.created_at DESC
  `;

  return result as unknown as Task[];
}

/**
 * Добавить событие в журнал задачи
 */
export async function addTaskEvent(
  taskId: string,
  event: string,
  payload: Record<string, any>
): Promise<void> {
  await sql`
    INSERT INTO task_events (task_id, event, payload)
    VALUES (${taskId}, ${event}, ${JSON.stringify(payload)})
  `;

  console.log(`✅ Task event: ${taskId} → ${event}`);
}

/**
 * Обработать завершение техобслуживания из UI события
 */
export async function handleMaintenanceCompleted(params: {
  serviceId: string;
  carId: string;
  carNumber: string;
  actor: string;
  description: string;
  timestamp: Date;
}): Promise<{ taskId: string; action: 'closed' | 'created_archived' }> {
  const { serviceId, carId, carNumber, actor, description, timestamp } = params;

  // 1. Попробовать найти существующую задачу по serviceId
  const existingTask = await findTaskByExternalRef('rentprog', serviceId);

  if (existingTask) {
    // 2a. Задача существует → закрыть её
    await updateTaskStatus(existingTask.id, 'done');

    await addTaskEvent(existingTask.id, 'completed', {
      completedBy: actor,
      completedAt: timestamp.toISOString(),
      description,
    });

    // TODO: Архивировать тему задачи в Telegram
    // await archiveTaskTopic(existingTask.tg_chat_id, existingTask.tg_topic_id);

    return { taskId: existingTask.id, action: 'closed' };
  } else {
    // 2b. Задачи нет → создать архивную запись
    const employee = await findEmployeeByName(actor);

    const task = await createTask({
      title: `Обслуживание: ${description.slice(0, 50)}...`,
      description: description,
      status: 'done', // сразу done, т.к. уже завершено
      priority: 'normal',
      creator_id: employee?.id,
      assignee_id: employee?.id,
      source: 'rentprog',
    });

    // Связать с машиной
    await linkTaskToEntity(task.id, 'car', carId);

    // Создать external_ref
    await createTaskExternalRef(task.id, 'rentprog', serviceId);

    await addTaskEvent(task.id, 'created', {
      source: 'ui_event_scraper',
      carNumber,
      completedBy: actor,
      completedAt: timestamp.toISOString(),
    });

    return { taskId: task.id, action: 'created_archived' };
  }
}

/**
 * Найти сотрудника по имени
 */
async function findEmployeeByName(name: string): Promise<{ id: string; name: string } | null> {
  const result = await sql`
    SELECT id, name
    FROM employees
    WHERE name = ${name}
  `;

  if (result.length === 0) {
    return null;
  }

  return result[0] as { id: string; name: string };
}

/**
 * Экспорт
 */
export default {
  createTask,
  updateTaskStatus,
  linkTaskToEntity,
  findTaskByExternalRef,
  createTaskExternalRef,
  getTasksByEntity,
  addTaskEvent,
  handleMaintenanceCompleted,
};

