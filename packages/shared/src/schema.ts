export interface Position {
  x: number;
  y: number;
}

export interface Column {
  name: string;
  type: string;
  primaryKey: boolean;
  nullable: boolean;
  unique: boolean;
  indexed: boolean;
  default?: string;
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
