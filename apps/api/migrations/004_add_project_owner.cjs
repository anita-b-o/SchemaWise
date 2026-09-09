/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.sql("LOCK TABLE projects IN ACCESS EXCLUSIVE MODE;");
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM projects LIMIT 1) THEN
        RAISE EXCEPTION 'Cannot add project ownership: projects table must be empty.';
      END IF;
    END
    $$;
  `);
  pgm.addColumns("projects", {
    owner_id: { type: "uuid", notNull: true },
  });
  pgm.addConstraint("projects", "projects_owner_id_fkey", {
    foreignKeys: {
      columns: "owner_id",
      references: "users(id)",
      onDelete: "RESTRICT",
    },
  });
  pgm.createIndex("projects", ["owner_id", { name: "updated_at", sort: "DESC" }, "id"], {
    name: "projects_owner_updated_id_idx",
  });
};

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.dropIndex("projects", ["owner_id", "updated_at", "id"], { name: "projects_owner_updated_id_idx" });
  pgm.dropConstraint("projects", "projects_owner_id_fkey");
  pgm.dropColumns("projects", ["owner_id"]);
};
