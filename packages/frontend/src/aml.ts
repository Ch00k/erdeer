import { parseAml as parse } from "@azimutt/aml";
import type { Column, Relation, Schema, Table } from "./types.js";

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

  // Collect PK attribute names per entity for lookup
  const pkAttrs = new Map<string, Set<string>>();
  for (const entity of db.entities ?? []) {
    if (entity.pk) {
      const names = new Set<string>();
      for (const attrPath of entity.pk.attrs) {
        if (attrPath.length > 0) names.add(attrPath[0]);
      }
      pkAttrs.set(entity.name, names);
    }
  }

  // Collect indexed attribute names per entity
  const indexedAttrs = new Map<string, Set<string>>();
  const uniqueAttrs = new Map<string, Set<string>>();
  for (const entity of db.entities ?? []) {
    for (const idx of entity.indexes ?? []) {
      const targetSet = idx.unique ? uniqueAttrs : indexedAttrs;
      if (!targetSet.has(entity.name)) targetSet.set(entity.name, new Set());
      for (const attrPath of idx.attrs) {
        if (attrPath.length > 0) targetSet.get(entity.name)!.add(attrPath[0]);
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
    const entityPk = pkAttrs.get(entity.name) ?? new Set();
    const entityIndexed = indexedAttrs.get(entity.name) ?? new Set();
    const entityUnique = uniqueAttrs.get(entity.name) ?? new Set();
    const entityChecks = checkAttrs.get(entity.name) ?? new Map();

    const columns: Column[] = (entity.attrs ?? []).map((attr) => ({
      name: attr.name,
      type: attr.type ?? "unknown",
      primaryKey: entityPk.has(attr.name),
      nullable: attr.null === true,
      unique: entityUnique.has(attr.name),
      indexed: entityIndexed.has(attr.name),
      default: attr.default != null ? String(attr.default) : undefined,
      check: entityChecks.get(attr.name),
      enumValues: attr.type ? enumTypes.get(attr.type) : undefined,
      comment: attr.doc ?? undefined,
    }));

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
