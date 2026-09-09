/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.createTable("projects", {
    id: { type: "uuid", primaryKey: true },
    name: { type: "varchar(120)", notNull: true },
    schema_json: { type: "jsonb", notNull: true },
    revision: { type: "integer", notNull: true, default: 1 },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("projects", "projects_revision_positive", { check: "revision > 0" });
  pgm.addConstraint("projects", "projects_name_not_blank", { check: "char_length(trim(name)) > 0" });
};

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.dropTable("projects");
};
