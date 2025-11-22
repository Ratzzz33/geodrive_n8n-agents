BEGIN;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_creator_id_fkey
  FOREIGN KEY (creator_id) REFERENCES employees(id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE tasks VALIDATE CONSTRAINT tasks_creator_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_assignee_id_fkey
  FOREIGN KEY (assignee_id) REFERENCES employees(id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE tasks VALIDATE CONSTRAINT tasks_assignee_id_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches(id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE tasks VALIDATE CONSTRAINT tasks_branch_id_fkey;

ALTER TABLE entity_timeline
  ADD CONSTRAINT entity_timeline_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES events(id)
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
ALTER TABLE entity_timeline VALIDATE CONSTRAINT entity_timeline_event_id_fkey;

COMMIT;

