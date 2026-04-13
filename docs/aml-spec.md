# AML (Azimutt Markup Language) Specification

A comprehensive reference for AML v2, the database schema definition language used by Azimutt.

## 1. Overview

AML is a concise, human-readable language for defining database schemas. It is database-agnostic and designed to be simpler and faster to write than SQL DDL. Key characteristics:

- Indentation-based (2-space indent for attributes under entities)
- NOT NULL by default (opposite of SQL)
- Supports entities (tables), relations (foreign keys), custom types, namespaces, properties, and documentation

## 2. Identifiers

Identifiers are names for entities, attributes, namespaces, types, etc.

**Rules:** Must match the regex `[a-zA-Z_][a-zA-Z0-9_#]*`
- Start with a letter or underscore
- Continue with letters, digits, underscores, or `#`
- Both `snake_case` and `CamelCase` are valid

**Quoting:** Identifiers containing spaces or special characters must be wrapped in double quotes:
```
"user events"
"varchar[]"
"timestamp with time zone"
```

## 3. Comments

Line comments start with `#`. Everything after `#` on a line is ignored by the parser.

```
# Section header comment
users
  id uuid pk  # inline comment
```

Comments cannot appear inside multiline documentation blocks (`|||`).

## 4. Entities

Entities model database tables, collections, or similar structures. An entity is a top-level identifier, optionally followed by attributes indented beneath it.

### 4.1 Basic syntax

```
<namespace.>entity_name<*> <as alias> <{properties}> <| documentation>
  attribute_name <type> <constraints> <{properties}> <| documentation>
```

**Minimal entity (no attributes):**
```
users
```

**Entity with attributes:**
```
users
  id uuid pk
  name varchar
  email varchar(256) unique
```

### 4.2 Aliases

Entities can be aliased with `as`. The alias can be used to reference the entity elsewhere:
```
db1.referential.identity.accounts as users
  id
  name

posts
  author -> users(id)
```

### 4.3 Views

Entities are marked as views with an asterisk `*` after the entity name:
```
active_users*
  id uuid
  name varchar
```

Optionally, the `view` property can hold the SQL query:
```
active_users* {view: "SELECT * FROM users WHERE active = true"}
  id uuid
  name varchar
```

## 5. Attributes

Attributes are defined indented (2 spaces) under their parent entity. They represent columns, fields, or properties.

### 5.1 Syntax

```
attribute_name <type> <constraints...> <{properties}> <| documentation>
```

All parts after the name are optional. An attribute with no type and no constraints is valid:
```
users
  id
  name
```

### 5.2 Types

Types follow the attribute name. Common types include `uuid`, `int`, `varchar`, `text`, `number`, `json`, `boolean`, `timestamp`. AML does not restrict types -- any identifier is accepted.

**Parameterized types:**
```
name varchar(50)
```

**Multi-word types (must be quoted):**
```
created_at "timestamp with time zone"
```

**Array types (must be quoted):**
```
tags "varchar[]"
```

**Inline enum types:** Define a custom type inline with the attribute:
```
status post_status(draft, published, archived)
```
This simultaneously defines a type named `post_status` with the given enum values and assigns it to the attribute.

### 5.3 Default values

Use `=` after the type (or after the attribute name if no type):
```
name varchar(50)=John
admin boolean=false
status post_status(draft, published, archived)=draft
```

**Null default:**
```
status varchar=null
```

**Expression defaults** use backticks:
```
created_at "timestamp with time zone"=`now()`
```

### 5.4 Constraints

Constraints follow the type and default value:

| Constraint | Syntax | Description |
|---|---|---|
| Primary key | `pk` or `pk=name` | Marks attribute as part of the primary key |
| Unique | `unique` | Unique constraint |
| Index | `index` or `index=name` | Database index |
| Nullable | `nullable` | Allows NULL values. **AML attributes are NOT NULL by default** (opposite of SQL) |
| Check | `check` or `check(`\`expression\``)` | Check constraint, optionally with a backtick-quoted expression |
| Relation | `-> target(attr)` | Inline foreign key (see Relations section) |

**Composite constraints** are created by giving constraints the same name using `=name`:
```
users
  first_name varchar unique=users_name_uniq
  last_name varchar unique=users_name_uniq
```
This creates a single composite unique constraint over both columns.

**Composite primary keys:**
```
user_roles
  user_id uuid pk -> users(id)
  role_id uuid pk -> roles(id)
```
Multiple attributes with `pk` form a composite primary key.

**Multiple constraints per attribute:** An attribute can carry more than one constraint of the same kind. This is useful when an attribute participates in several composite indexes:
```
route_stop
  airport varchar(3) index=idx_airport_role index=idx_airport_dep index=idx_airport_arr
  role varchar(20) index=idx_airport_role
  departure_date date index=idx_airport_dep
  arrival_date date index=idx_airport_arr
```

**Check constraint with name:**
```
age int check(`age > 0`)=age_chk
```

### 5.5 Nested attributes

For JSON/document columns, define sub-attributes indented under the parent:

```
users
  id uuid pk
  details json
    github_url varchar nullable unique
    company json nullable
      id uuid -> companies(id)
      name varchar
  friends "json[]"
    id number -> users(id)
```

Nested attributes can have their own types, constraints, relations, and further nesting.

**Referencing nested attributes** uses dot notation: `events(details.user_id)`, `users(details.twitter_id)`.

## 6. Relations

Relations represent foreign keys / edges in the entity-relationship model.

### 6.1 Inline relations

Defined as a constraint on an attribute:
```
posts
  author_id uuid -> users(id)
```

### 6.2 Standalone relations

Defined at the top level with the `rel` keyword:
```
rel posts(author_id) -> users(id)
```

### 6.3 Omitting target attribute

When the target entity has a single-attribute primary key, the target attribute can be omitted. The type of the source attribute is inferred from the target PK:
```
rel posts(author_id) -> users
```
```
posts
  author_id -> users
```

### 6.4 Cardinality

| Symbol | Cardinality | Description |
|---|---|---|
| `->` | Many-to-one | Default. Many source rows reference one target row |
| `--` | One-to-one | Warns if neither side has a unique constraint |
| `<>` | Many-to-many | Logical relationship (typically via a join table) |

```
profiles
  id uuid pk -- users(id)

rel projects(id) <> users(id)
```

### 6.5 Composite relations

Multiple attributes form a single foreign key:
```
rel credential_details(provider_key, provider_uid) -> credentials(provider_key, provider_uid)
```

### 6.6 Nested attribute relations

Relations can reference nested attributes using dot notation:
```
rel events(details.company.id) -> companies(id)
rel tweets(profile) -> users(details.twitter_id)
```

### 6.7 Polymorphic relations

A source attribute references different target entities based on a discriminator column value. Syntax uses `-discriminator=value>` instead of `->`:
```
events
  item_kind event_items(users, projects)
  item_id

rel events(item_id) -item_kind=users> users
rel events(item_id) -item_kind=projects> projects
```

Or with inline syntax:
```
comments
  item_kind varchar
  item_id uuid

rel comments(item_id) -item_kind=posts> posts(id)
rel comments(item_id) -item_kind=pages> pages(id)
```

### 6.8 Relation properties and documentation

Standalone relations support properties and documentation:
```
rel posts(author) -> users(id) {onUpdate: "no action", onDelete: cascade} | link post author
```

**Recognized relation properties:**
- `onUpdate`: `"no action"`, `"set null"`, `"set default"`, `cascade`, `restrict`
- `onDelete`: same values as `onUpdate`

## 7. Custom Types

Defined at the top level with the `type` keyword.

### 7.1 Abstract type (no definition)

```
type bug_status
```

### 7.2 Alias

Maps to another type:
```
type bug_status varchar
type issue_status bug_status
```

### 7.3 Enum

A set of named values in parentheses. Values with spaces must be quoted:
```
type bug_status (new, "in progress", done)
```

Enums can also be defined inline on an attribute (see section 5.2).

### 7.4 Struct

A composite type with named fields in curly braces:
```
type position {x int, y int}
```

### 7.5 Custom/raw

Database-specific type definitions in backticks:
```
type float8_range `RANGE (subtype = float8, subtype_diff = float8mi)`
```

### 7.6 Type namespaces

Types can be namespaced like entities:
```
type reporting.public.bug_status varchar
```

### 7.7 Type properties and documentation

```
type bug_status varchar {private, tags: [seo]} | defining a post status
```

Note: When a type is defined inline on an attribute, properties and documentation are assigned to the attribute, not the type.

## 8. Namespaces

Entities, relations, and types can be organized into up to three hierarchical levels: **database**, **catalog**, **schema**.

### 8.1 Explicit namespacing

```
public.users                    # schema only
core.public.users               # catalog.schema
analytics.core.public.users     # database.catalog.schema
```

Intermediate levels can be skipped with empty segments:
```
analytics...users               # database, no catalog, no schema
```

### 8.2 Namespace directive

Sets a default namespace for subsequent definitions. The directive applies until the next `namespace` directive or end of file:

```
namespace core.public

users        # resolves to core.public.users
posts        # resolves to core.public.posts
```

**Properties and documentation:** Namespace directives support properties, documentation, and comments:
```
namespace public {color: blue} | the public schema # comment
```

**Override:** An explicit namespace on an entity overrides the directive:
```
namespace core.public
dto.users    # resolves to dto.users, NOT core.public.dto.users
```

**Replace:** A new `namespace` directive fully replaces the previous one:
```
namespace auth
users        # auth.users

namespace seo
posts        # seo.posts
```

**Clear:** An empty `namespace` clears the default:
```
namespace public
users        # public.users

namespace
posts        # posts (no namespace)
```

### 8.3 Namespaces in relations

```
rel public.posts(user_id) -> auth.users(id)
```

## 9. Properties

Key-value metadata defined in curly braces `{}` on entities, attributes, relations, and types.

### 9.1 Value formats

| Format | Example |
|---|---|
| Boolean | `{pii: true}` |
| Number | `{size: 12}` |
| Identifier/string | `{color: red}` |
| Array | `{tags: [pii, sensitive]}` |
| Flag (value omitted = true) | `{autoIncrement}` |
| Quoted string | `{onDelete: "set null"}` |

### 9.2 Recognized entity properties

| Property | Values | Description |
|---|---|---|
| `color` | red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose, gray | Entity color in diagrams |
| `tags` | array of identifiers | Classification tags |
| `view` | SQL string | Holds the SQL query for a view entity (used with `*` view indicator) |
| `deprecated` | flag | Marks entity as deprecated |

### 9.3 Recognized attribute properties

| Property | Description |
|---|---|
| `autoIncrement` | Auto-incrementing column |
| `hidden` | Hidden by default in diagram layouts |
| `tags` | Classification tags |

### 9.4 Recognized relation properties

| Property | Values |
|---|---|
| `onUpdate` | `"no action"`, `"set null"`, `"set default"`, `cascade`, `restrict` |
| `onDelete` | same as `onUpdate` |

### 9.5 Multiple properties

Comma-separated within the braces:
```
users {color: red, tags: [pii, deprecated]}
  id int pk {autoIncrement}
```

## 10. Documentation

Textual documentation attached to entities, attributes, relations, or types. Rendered as Markdown in Azimutt.

### 10.1 Inline documentation

Uses the pipe character `|` after the definition:
```
users | storing all users
  id uuid pk
  email varchar unique | auth identifier
```

### 10.2 Multiline documentation

Uses triple pipes `|||` as delimiters:
```
users |||
  storing
  all users
|||
  id uuid pk
  email varchar unique |||
    auth
    identifier
  |||
```

Common leading indentation is automatically stripped from multiline blocks.

### 10.3 Documentation on all object types

```
type post_status (draft, published, archived) | post lifecycle
public.users | storing all users
  email varchar unique | auth identifier
rel posts(author) -> public.users(id) | link post author
```

## 11. Full Example

```
# Identity domain

type user_role (customer, staff, admin)

namespace public

users | the user table
  id uuid pk
  slug varchar unique
  role user_role=customer
  email varchar unique
  email_validated timestamp nullable=null
  created_at "timestamp with time zone"=`now()`

# Catalog domain

products
  id uuid pk
  category_id uuid nullable -> categories(id)
  title varchar
  price number
  tags "varchar[]"

categories
  id uuid pk
  name varchar unique

# Orders domain

orders
  id uuid pk
  user_id uuid -> users(id)
  created_at timestamp

order_lines
  id uuid pk
  order_id uuid -> orders(id)
  product_id uuid -> products(id)
  quantity int check(`quantity > 0`)

# Polymorphic comments

comments
  id uuid pk
  item_kind varchar
  item_id uuid
  body text
  author_id uuid -> users(id)

rel comments(item_id) -item_kind=products> products(id)
rel comments(item_id) -item_kind=orders> orders(id)
```

## 12. Grammar Summary (Pseudo-BNF)

```
<source>       ::= (<statement> NEWLINE)*
<statement>    ::= <entity> | <relation> | <type> | <namespace> | <comment> | <empty>

<comment>      ::= '#' <text>
<namespace>    ::= 'namespace' <namespace_path>? <props>? <doc>?
<entity>       ::= <entity_ref> '*'? ('as' <identifier>)? <props>? <doc>? NEWLINE <attribute>*
<attribute>    ::= INDENT <identifier> <type_ref>? <default>? <constraint>* <props>? <doc>? NEWLINE <attribute>*
<relation>     ::= 'rel' <attr_ref> <rel_symbol> <attr_ref> <props>? <doc>?
                 | 'rel' <attr_ref> '-' <identifier> '=' <identifier> '>' <attr_ref> <props>? <doc>?
<type_def>     ::= 'type' <type_ref> <type_body>? <props>? <doc>?

<entity_ref>   ::= <namespace_path>? <identifier>
<attr_ref>     ::= <entity_ref> '(' <identifier> (',' <identifier>)* ')'
<type_ref>     ::= <namespace_path>? <identifier> <type_params>?
<type_params>  ::= '(' <identifier> (',' <identifier>)* ')'    -- enum values
<type_body>    ::= <identifier>                                  -- alias
                 | '(' <identifier> (',' <identifier>)* ')'      -- enum
                 | '{' <identifier> <type_ref> (',' <identifier> <type_ref>)* '}'  -- struct
                 | '`' <text> '`'                                -- custom/raw

<namespace_path> ::= <identifier> ('.' <identifier>)* '.'

<default>      ::= '=' <identifier> | '=' 'null' | '=' '`' <text> '`'
<constraint>   ::= 'pk' ('=' <identifier>)? | 'unique' ('=' <identifier>)? | 'index' ('=' <identifier>)?
                 | 'nullable' | 'check' ('(' '`' <text> '`' ')')? ('=' <identifier>)?
                 | <rel_symbol> <attr_ref>?
<rel_symbol>   ::= '->' | '--' | '<>'

<props>        ::= '{' <prop> (',' <prop>)* '}'
<prop>         ::= <identifier> (':' <prop_value>)?
<prop_value>   ::= <identifier> | <number> | <bool> | <quoted_string> | '[' <identifier> (',' <identifier>)* ']'

<doc>          ::= '|' <text>
                 | '|||' NEWLINE <text> NEWLINE '|||'

<identifier>   ::= [a-zA-Z_][a-zA-Z0-9_#]*
                 | '"' <text> '"'
<quoted_string>::= '"' <text> '"'
```

## 13. Key Differences from SQL

| Aspect | AML | SQL |
|---|---|---|
| Nullability default | NOT NULL | NULL |
| Syntax | Indentation-based, concise | Keyword-heavy, verbose |
| Relations | Inline or standalone `rel` | `FOREIGN KEY ... REFERENCES` |
| Enums | Inline with type definition | Separate `CREATE TYPE` |
| Nested attributes | Native (indentation) | Not supported |
| Polymorphic relations | Native syntax | No standard syntax |
| Properties/metadata | Native `{key: value}` | `COMMENT ON` or vendor-specific |
| Documentation | `|` or `|||` pipe syntax | `COMMENT ON` |

## 14. Source

Based on the official AML documentation at https://azimutt.app/docs/aml (AML v2).
The `@azimutt/aml` npm package provides the parser implementation.
Parser source code: https://github.com/azimuttapp/azimutt/tree/main/libs/aml
