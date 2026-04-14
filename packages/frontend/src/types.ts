// Re-exported for convenience within the frontend package.
// Once the shared package is wired up as a dependency, these
// can be replaced with re-exports from @erdeer/shared.

export interface Position {
  x: number;
  y: number;
}

export interface NamedConstraint {
  name?: string;
  columns: string[];
}

export interface Column {
  name: string;
  type: string;
  primaryKey: boolean;
  primaryKeyColumns?: string[];
  nullable: boolean;
  unique: boolean;
  uniqueConstraints?: NamedConstraint[];
  indexed: boolean;
  indexes?: NamedConstraint[];
  default?: string;
  check?: string;
  enumValues?: string[];
  comment?: string;
}

export interface Table {
  schema?: string;
  name: string;
  columns: Column[];
  comment?: string;
  position: Position;
}

export interface Relation {
  name?: string;
  src: { table: string; column: string };
  ref: { table: string; column: string };
  cardinality: "one-to-one" | "many-to-one" | "many-to-many";
}

export interface Schema {
  tables: Table[];
  relations: Relation[];
}

export interface CommentUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ThreadComment {
  id: string;
  threadId: string;
  user: CommentUser;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentThread {
  id: string;
  diagramId: string;
  anchorType: "diagram" | "entity" | "column";
  anchorEntity: string | null;
  anchorColumn: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdBy: CommentUser;
  updatedBy: CommentUser;
  comments: ThreadComment[];
  createdAt: string;
  updatedAt: string;
}
