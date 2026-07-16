import { and, eq, or } from "drizzle-orm";
import { projectsTable } from "@workspace/db";

/**
 * Access predicate for reading/working inside a project: the owner always
 * qualifies, and team-shared projects are open to every signed-in account.
 * Owner-only operations (settings, share toggle, delete) must keep the
 * plain userId equality check instead.
 */
export function projectAccessWhere(projectId: string, userId: string) {
  return and(
    eq(projectsTable.id, projectId),
    or(eq(projectsTable.userId, userId), eq(projectsTable.isShared, true)),
  );
}
