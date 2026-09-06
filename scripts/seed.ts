/**
 * Seed the library with a few example prompts so a fresh database isn't empty.
 * Writes through Drizzle directly, so it needs no running server.
 *   DATABASE_URL=... npx tsx scripts/seed.ts
 */
import "./load-env";
import { db } from "../src/db";
import {
  categories,
  folders,
  promptCategories,
  promptVersions,
  prompts,
} from "../src/db/schema";

async function addPrompt(input: {
  title: string;
  content: string;
  notes?: string | null;
  folderId?: string | null;
  categoryIds?: string[];
}) {
  const [prompt] = await db
    .insert(prompts)
    .values({
      title: input.title,
      content: input.content,
      notes: input.notes ?? null,
      folderId: input.folderId ?? null,
    })
    .returning();

  if (input.categoryIds?.length) {
    await db.insert(promptCategories).values(
      input.categoryIds.map((categoryId) => ({
        promptId: prompt.id,
        categoryId,
      })),
    );
  }

  // Mirror createPrompt(): every prompt starts with one recorded version.
  await db.insert(promptVersions).values({
    promptId: prompt.id,
    content: prompt.content,
    source: "manual",
  });
}

async function main() {
  console.log("Seeding…");

  const [writing] = await db
    .insert(folders)
    .values({ name: "Writing" })
    .returning();
  const [blog] = await db
    .insert(folders)
    .values({ name: "Blog posts", parentId: writing.id })
    .returning();
  const [code] = await db
    .insert(folders)
    .values({ name: "Code review" })
    .returning();

  const [marketing, drafting, engineering] = await db
    .insert(categories)
    .values([
      { name: "marketing" },
      { name: "drafting" },
      { name: "engineering" },
    ])
    .returning();

  await addPrompt({
    title: "Blog post outline",
    content: `Write a detailed outline for a blog post about {{topic}}.

Audience: {{audience}}
Tone: {{tone}}

Include a hook, 3-5 main sections with supporting points, and a closing call to action.`,
    notes:
      "Works best when the topic is narrow. Vague topics give generic sections.",
    folderId: blog.id,
    categoryIds: [marketing.id, drafting.id],
  });

  await addPrompt({
    title: "Cold email opener",
    content: `Write three opening lines for a cold email to {{persona}} at {{company_type}} companies.

Each opener should reference a specific, checkable detail rather than flattery. Max 20 words each.`,
    folderId: writing.id,
    categoryIds: [marketing.id],
  });

  await addPrompt({
    title: "PR review checklist",
    content: `Review this pull request as a senior engineer.

For each finding give: the file and line, what breaks, and the concrete input that triggers it. Rank by severity. Skip style nits unless they hide a bug.

{{diff}}`,
    folderId: code.id,
    categoryIds: [engineering.id],
  });

  await addPrompt({
    title: "Explain like I know the adjacent field",
    content: `Explain {{concept}} to someone fluent in {{known_field}}.

Anchor the explanation in an analogy from that field, name where the analogy breaks down, then give me two questions to check I actually understood it.`,
    notes: "Good for picking up a new area fast.",
    categoryIds: [drafting.id],
  });

  console.log("Seeded 3 folders, 3 tags, 4 prompts.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
