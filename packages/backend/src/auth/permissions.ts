import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { rolePermissions } from "../db/schema.js";

// If a role has no explicit permissions, it is granted all permissions.
// Once any permission is defined for a role, only those permissions are granted.
export async function hasPermission(role: string, permission: string): Promise<boolean> {
  const defined = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role))
    .all();

  if (defined.length === 0) {
    return true;
  }

  return defined.some((row) => row.permission === permission);
}
