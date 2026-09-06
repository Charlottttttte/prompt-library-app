import type { FolderTreeNode } from "./queries";
import type { FolderOption } from "@/components/prompt-form";

/**
 * Flatten the folder tree into `<select>` options, indenting each level so the
 * nesting is still readable in a control that can't render a real tree.
 */
export function flattenFolderOptions(
  tree: FolderTreeNode[],
  depth = 0,
): FolderOption[] {
  return tree.flatMap((node) => [
    { id: node.id, label: `${"— ".repeat(depth)}${node.name}` },
    ...flattenFolderOptions(node.children, depth + 1),
  ]);
}

/** Breadcrumb path to a folder, e.g. ["Writing", "Blog posts"]. */
export function folderPath(
  tree: FolderTreeNode[],
  folderId: string,
): string[] | null {
  for (const node of tree) {
    if (node.id === folderId) return [node.name];
    const nested = folderPath(node.children, folderId);
    if (nested) return [node.name, ...nested];
  }
  return null;
}
