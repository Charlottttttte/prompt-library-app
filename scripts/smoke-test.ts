/**
 * Schema smoke test — exercises every table and relation against a real
 * Postgres instance. Run with:
 *   DATABASE_URL=... npx tsx scripts/smoke-test.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  folders,
  prompts,
  categories,
  promptCategories,
  promptVersions,
} from "../src/db/schema";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function main() {
  console.log("Running schema smoke test...\n");

  // --- Folders, including nesting -----------------------------------------
  const [parent] = await db
    .insert(folders)
    .values({ name: "Writing" })
    .returning();
  const [child] = await db
    .insert(folders)
    .values({ name: "Blog posts", parentId: parent.id })
    .returning();
  assert(child.parentId === parent.id, "folders nest via parentId");

  // --- Prompts ------------------------------------------------------------
  const [prompt] = await db
    .insert(prompts)
    .values({
      title: "Blog outline",
      content: "Write a blog outline about {{topic}}.",
      folderId: child.id,
    })
    .returning();
  assert(prompt.folderId === child.id, "prompt saves into a folder");

  // --- Categories many-to-many -------------------------------------------
  const inserted = await db
    .insert(categories)
    .values([{ name: "marketing" }, { name: "drafting" }])
    .returning();
  await db.insert(promptCategories).values(
    inserted.map((c) => ({
      promptId: prompt.id,
      categoryId: c.id,
    })),
  );
  const withCategories = await db.query.prompts.findFirst({
    where: eq(prompts.id, prompt.id),
    with: {
      folder: true,
      promptCategories: { with: { category: true } },
    },
  });
  assert(
    withCategories?.promptCategories.length === 2,
    "prompt carries two categories",
  );
  assert(
    withCategories?.folder?.name === "Blog posts",
    "prompt joins back to its folder",
  );

  // --- Unique category names ---------------------------------------------
  let duplicateRejected = false;
  try {
    await db.insert(categories).values({ name: "marketing" });
  } catch {
    duplicateRejected = true;
  }
  assert(duplicateRejected, "duplicate category names are rejected");

  // --- Version history ----------------------------------------------------
  await db.insert(promptVersions).values([
    { promptId: prompt.id, content: "v1 original", source: "manual" },
    {
      promptId: prompt.id,
      content: "v2 optimized",
      source: "optimized",
      model: "claude-sonnet-4-5",
    },
  ]);
  const versions = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.promptId, prompt.id));
  assert(versions.length === 2, "version history records manual + optimized");

  // --- Deleting a folder moves its prompts to the root, never deletes them -
  await db.delete(folders).where(eq(folders.id, child.id));
  const orphan = await db.query.prompts.findFirst({
    where: eq(prompts.id, prompt.id),
  });
  assert(orphan !== undefined, "prompt survives deletion of its folder");
  assert(orphan?.folderId === null, "orphaned prompt falls back to the root");

  // --- Deleting a parent folder cascades to children ----------------------
  const [gp] = await db.insert(folders).values({ name: "Temp" }).returning();
  const [kid] = await db
    .insert(folders)
    .values({ name: "Temp child", parentId: gp.id })
    .returning();
  await db.delete(folders).where(eq(folders.id, gp.id));
  const kidGone = await db.query.folders.findFirst({
    where: eq(folders.id, kid.id),
  });
  assert(kidGone === undefined, "deleting a folder cascades to subfolders");

  // --- Deleting a prompt cascades to its versions and category links ------
  await db.delete(prompts).where(eq(prompts.id, prompt.id));
  const leftoverVersions = await db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.promptId, prompt.id));
  assert(
    leftoverVersions.length === 0,
    "deleting a prompt cascades to its versions",
  );

  console.log("\nAll checks passed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n" + err.message);
    process.exit(1);
  });
