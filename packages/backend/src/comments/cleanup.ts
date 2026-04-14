import { parseAml } from "@azimutt/aml";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/connection.js";
import { commentThreads } from "../db/schema.js";

export function cleanupOrphanedThreads(diagramId: string, amlContent: string): void {
  try {
    const result = parseAml(amlContent);
    const entities = result.result?.entities ?? [];

    // Build lookup: entity name -> set of column names
    const entityColumns = new Map<string, Set<string>>();
    for (const entity of entities) {
      const columns = new Set((entity.attrs ?? []).map((a) => a.name));
      entityColumns.set(entity.name, columns);
    }

    // Find threads anchored to entities or columns
    const threads = db
      .select({
        id: commentThreads.id,
        anchorType: commentThreads.anchorType,
        anchorEntity: commentThreads.anchorEntity,
        anchorColumn: commentThreads.anchorColumn,
      })
      .from(commentThreads)
      .where(
        and(
          eq(commentThreads.diagramId, diagramId),
          inArray(commentThreads.anchorType, ["entity", "column"]),
        ),
      )
      .all();

    const orphanIds: string[] = [];
    for (const thread of threads) {
      if (!thread.anchorEntity) {
        orphanIds.push(thread.id);
        continue;
      }

      const columns = entityColumns.get(thread.anchorEntity);
      if (!columns) {
        // Entity no longer exists
        orphanIds.push(thread.id);
      } else if (
        thread.anchorType === "column" &&
        thread.anchorColumn &&
        !columns.has(thread.anchorColumn)
      ) {
        // Column no longer exists
        orphanIds.push(thread.id);
      }
    }

    if (orphanIds.length > 0) {
      db.delete(commentThreads).where(inArray(commentThreads.id, orphanIds)).run();
    }
  } catch {
    // Cleanup failure is acceptable
  }
}
