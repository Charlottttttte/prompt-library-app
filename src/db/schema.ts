import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Folders — support arbitrary nesting via a self-referencing parent.
 * Deleting a folder cascades to its children; prompts inside are moved to the
 * root (folderId -> null) rather than deleted, so no prompt is ever lost.
 */
export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("folders_parent_id_idx").on(table.parentId)],
);

/**
 * Prompts — the core entity. `folderId` is nullable: a prompt with no folder
 * lives at the root of the library.
 */
export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    notes: text("notes"),
    folderId: uuid("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("prompts_folder_id_idx").on(table.folderId)],
);

/**
 * Categories (tags) — a flat, workspace-wide set applied to prompts many-to-many.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("categories_name_unique_idx").on(table.name)],
);

/** Join table for the prompt <-> category many-to-many relation. */
export const promptCategories = pgTable(
  "prompt_categories",
  {
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.promptId, table.categoryId] }),
    index("prompt_categories_category_id_idx").on(table.categoryId),
  ],
);

/**
 * Version history — every save of a prompt's content is appended here, so an
 * AI-optimized rewrite can always be compared against, or reverted to, what
 * came before it.
 */
export const promptVersionSources = ["manual", "optimized"] as const;
export type PromptVersionSource = (typeof promptVersionSources)[number];

export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /** How this version came to be: a hand edit, or an accepted AI rewrite. */
    source: text("source").$type<PromptVersionSource>().notNull(),
    /** For optimized versions: the model that produced the rewrite. */
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("prompt_versions_prompt_id_idx").on(table.promptId)],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                   */
/* -------------------------------------------------------------------------- */

export const foldersRelations = relations(folders, ({ one, many }) => ({
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: "folder_children",
  }),
  children: many(folders, { relationName: "folder_children" }),
  prompts: many(prompts),
}));

export const promptsRelations = relations(prompts, ({ one, many }) => ({
  folder: one(folders, {
    fields: [prompts.folderId],
    references: [folders.id],
  }),
  promptCategories: many(promptCategories),
  versions: many(promptVersions),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  promptCategories: many(promptCategories),
}));

export const promptCategoriesRelations = relations(
  promptCategories,
  ({ one }) => ({
    prompt: one(prompts, {
      fields: [promptCategories.promptId],
      references: [prompts.id],
    }),
    category: one(categories, {
      fields: [promptCategories.categoryId],
      references: [categories.id],
    }),
  }),
);

export const promptVersionsRelations = relations(promptVersions, ({ one }) => ({
  prompt: one(prompts, {
    fields: [promptVersions.promptId],
    references: [prompts.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type NewPromptVersion = typeof promptVersions.$inferInsert;
