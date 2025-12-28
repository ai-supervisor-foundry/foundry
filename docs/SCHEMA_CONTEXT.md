# Schema Context

- The supervisor state schema is:
  - NOT a database schema
  - NOT an application domain model
  - NOT a runtime memory of Cursor
  - NOT a relational schema

- It IS:
  - a persisted CONTROL STATE
  - owned by the supervisor
  - written and read explicitly by the control loop
  - serializable as JSON
  - serialized as JSON and stored as a single Redis-compatible value
  - also usable as a flat JSON file on disk

- It represents:
  - the current supervisory control state
  - NOT business data
  - NOT user data
  - NOT app data

