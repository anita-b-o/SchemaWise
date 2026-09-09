/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.up = (pgm) => {
  pgm.createTable("sessions", {
    id: { type: "uuid", primaryKey: true },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    token_hash: { type: "bytea", notNull: true, unique: true },
    expires_at: { type: "timestamptz", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("sessions", "user_id", { name: "sessions_user_id_idx" });
  pgm.createIndex("sessions", "expires_at", { name: "sessions_expires_at_idx" });
};

/** @type {import('node-pg-migrate').MigrationBuilderActions} */
exports.down = (pgm) => {
  pgm.dropTable("sessions");
};
