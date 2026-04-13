import { parseAml as parse } from "@azimutt/aml";
import type { Column, NamedConstraint, Relation, Schema, Table } from "./types.js";

const TABLE_SPACING_X = 320;
const TABLE_SPACING_Y = 40;
const COLUMNS_PER_ROW = 3;

function layoutPosition(index: number): { x: number; y: number } {
  const col = index % COLUMNS_PER_ROW;
  const row = Math.floor(index / COLUMNS_PER_ROW);
  return {
    x: 40 + col * TABLE_SPACING_X,
    y: 40 + row * (200 + TABLE_SPACING_Y),
  };
}

export function parseAml(input: string): Schema {
  const result = parse(input);

  const db = result.result;
  if (!db) {
    return { tables: [], relations: [] };
  }

  // Collect PK columns per entity
  const pkColumns = new Map<string, string[]>();
  for (const entity of db.entities ?? []) {
    if (entity.pk) {
      const names = entity.pk.attrs.map((p) => p[0]).filter(Boolean);
      if (names.length > 0) pkColumns.set(entity.name, names);
    }
  }

  // Collect indexes and unique constraints per entity per column
  const indexesByAttr = new Map<string, Map<string, NamedConstraint[]>>();
  const uniqueByAttr = new Map<string, Map<string, NamedConstraint[]>>();
  for (const entity of db.entities ?? []) {
    for (const idx of entity.indexes ?? []) {
      const columns = idx.attrs.map((p) => p[0]).filter(Boolean);
      if (columns.length === 0) continue;
      const constraint: NamedConstraint = { name: idx.name, columns };
      const targetMap = idx.unique ? uniqueByAttr : indexesByAttr;
      if (!targetMap.has(entity.name)) targetMap.set(entity.name, new Map());
      const attrMap = targetMap.get(entity.name)!;
      for (const col of columns) {
        if (!attrMap.has(col)) attrMap.set(col, []);
        attrMap.get(col)!.push(constraint);
      }
    }
  }

  // Collect check constraint predicates per entity per attribute
  const checkAttrs = new Map<string, Map<string, string>>();
  for (const entity of db.entities ?? []) {
    for (const chk of entity.checks ?? []) {
      if (!chk.predicate) continue;
      if (!checkAttrs.has(entity.name)) checkAttrs.set(entity.name, new Map());
      for (const attrPath of chk.attrs) {
        if (attrPath.length > 0) {
          checkAttrs.get(entity.name)!.set(attrPath[0], chk.predicate);
        }
      }
    }
  }

  // Collect enum values by type name
  const enumTypes = new Map<string, string[]>();
  for (const type of db.types ?? []) {
    if (type.values) {
      enumTypes.set(type.name, type.values);
    }
  }

  const tables: Table[] = (db.entities ?? []).map((entity, i) => {
    const pos = layoutPosition(i);
    const entityPkColumns = pkColumns.get(entity.name);
    const entityPkSet = new Set(entityPkColumns);
    const entityIndexes = indexesByAttr.get(entity.name) ?? new Map();
    const entityUniques = uniqueByAttr.get(entity.name) ?? new Map();
    const entityChecks = checkAttrs.get(entity.name) ?? new Map();

    const columns: Column[] = (entity.attrs ?? []).map((attr) => {
      const isPk = entityPkSet.has(attr.name);
      const attrIndexes = entityIndexes.get(attr.name);
      const attrUniques = entityUniques.get(attr.name);
      return {
        name: attr.name,
        type: attr.type ?? "unknown",
        primaryKey: isPk,
        primaryKeyColumns:
          isPk && entityPkColumns && entityPkColumns.length > 1 ? entityPkColumns : undefined,
        nullable: attr.null === true,
        unique: attrUniques != null,
        uniqueConstraints: attrUniques,
        indexed: attrIndexes != null,
        indexes: attrIndexes,
        default: attr.default != null ? String(attr.default) : undefined,
        check: entityChecks.get(attr.name),
        enumValues: attr.type ? enumTypes.get(attr.type) : undefined,
        comment: attr.doc ?? undefined,
      };
    });

    // TODO: extract view property from entity.extra and pass to Table for visual badge
    return {
      schema: entity.schema ?? undefined,
      name: entity.name,
      columns,
      comment: entity.doc ?? undefined,
      position: pos,
    };
  });

  const relations: Relation[] = (db.relations ?? []).map((rel) => {
    const srcEntity = rel.src?.entity ?? "";
    const srcAttr = rel.src?.attrs?.[0]?.[0] ?? "";
    const refEntity = rel.ref?.entity ?? "";
    const refAttr = rel.ref?.attrs?.[0]?.[0] ?? "";

    // Determine cardinality from src/ref cardinality fields
    // -> (many-to-one): src.cardinality=n, ref.cardinality=1
    // -- (one-to-one): src.cardinality=1, ref.cardinality=1
    // <> (many-to-many): src.cardinality=n, ref.cardinality=n
    let cardinality: Relation["cardinality"] = "many-to-one";
    if (rel.src?.cardinality === "1" && rel.ref?.cardinality === "1") {
      cardinality = "one-to-one";
    } else if (rel.src?.cardinality === "n" && rel.ref?.cardinality === "n") {
      cardinality = "many-to-many";
    }

    return {
      name: rel.name ?? undefined,
      src: { table: srcEntity, column: srcAttr },
      ref: { table: refEntity, column: refAttr },
      cardinality,
    };
  });

  return { tables, relations };
}
