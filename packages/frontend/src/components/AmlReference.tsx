import { useCallback, useEffect, useState } from "react";
import styles from "./AmlReference.module.css";
import { AML_LANGUAGE_ID, useMonaco } from "./monacoContext.js";
import { getThemeColors } from "./monacoThemes.js";
import { ResizeHandle } from "./ResizeHandle.js";

const WIDTH_STORAGE_KEY = "erdeer_aml_reference_width";
const MIN_WIDTH = 280;
const MAX_WIDTH = 800;

function readStoredWidth(): number {
  try {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (saved) {
      const n = Number(saved);
      if (Number.isFinite(n)) return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
    }
  } catch {}
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(window.innerWidth * 0.25)));
}

interface AmlReferenceProps {
  onClose: () => void;
}

export function AmlReference({ onClose }: AmlReferenceProps) {
  const [width, setWidth] = useState<number>(readStoredWidth);

  const handleResize = useCallback((deltaX: number) => {
    setWidth((w) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w - deltaX)));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
    } catch {}
  }, [width]);

  return (
    <div className={styles.panel} style={{ width }}>
      <div className={styles.resizeHandle}>
        <ResizeHandle onResize={handleResize} />
      </div>
      <div className={styles.header}>
        <span>AML Reference</span>
        <button className={styles.closeButton} onClick={onClose} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className={styles.content}>
        <Section title="Entities (Tables)">
          <Code>{`users
  id uuid pk
  name varchar
  email varchar(256) unique`}</Code>
          <P>
            Attributes are indented 2 spaces under the entity name. All attributes are{" "}
            <strong>NOT NULL by default</strong> (opposite of SQL).
          </P>
        </Section>

        <Section title="Views">
          <Code>{`active_users*
  id uuid
  name varchar`}</Code>
          <P>
            Add <C>*</C> after the entity name to mark it as a view.
          </P>
        </Section>

        <Section title="Types">
          <Code>{`name varchar(50)
created_at "timestamp with time zone"
tags "varchar[]"
role user_role(admin, member)`}</Code>
          <P>
            Multi-word types and array types must be quoted. Inline enums define and assign a type
            in one step.
          </P>
        </Section>

        <Section title="Default Values">
          <Code>{`name varchar=John
admin boolean=false
status varchar=null
created_at timestamp=\`now()\``}</Code>
          <P>
            Use <C>=</C> after the type. Expression defaults use backticks.
          </P>
        </Section>

        <Section title="Constraints">
          <table className={styles.table}>
            <tbody>
              <Tr k="pk" v="Primary key" />
              <Tr k="unique" v="Unique constraint" />
              <Tr k="index or index=name" v="Database index" />
              <Tr k="nullable" v="Allows NULL" />
              <Tr k="check" v="Check constraint" />
              <Tr k={`check(\`age > 0\`)`} v="Check with expression" />
            </tbody>
          </table>
          <P>
            Composite constraints share a name: <C>first_name varchar unique=name_uniq</C>. An
            attribute can carry multiple constraints of the same kind:{" "}
            <C>airport varchar index=idx_a index=idx_b</C>
          </P>
        </Section>

        <Section title="Relations (Foreign Keys)">
          <Code>{`# Inline
posts
  author_id uuid -> users(id)

# Standalone
rel posts(author_id) -> users(id)

# Target attribute can be omitted if target has a single-column PK
posts
  author_id -> users`}</Code>
          <table className={styles.table}>
            <tbody>
              <Tr k="->" v="Many-to-one (default)" />
              <Tr k="--" v="One-to-one" />
              <Tr k="<>" v="Many-to-many" />
            </tbody>
          </table>
        </Section>

        <Section title="Composite Relations">
          <Code>
            {`rel credential_details(provider_key, provider_uid)
  -> credentials(provider_key, provider_uid)`}
          </Code>
        </Section>

        <Section title="Nested Attributes">
          <Code>{`users
  id uuid pk
  details json
    github_url varchar nullable
    company json
      id uuid -> companies(id)
      name varchar`}</Code>
          <P>
            Reference nested attributes with dots: <C>events(details.user_id)</C>
          </P>
        </Section>

        <Section title="Custom Types">
          <Code>{`type bug_status (new, "in progress", done)
type position {x int, y int}
type float8_range \`RANGE (subtype = float8)\``}</Code>
          <P>Enums use parentheses, structs use braces, raw SQL uses backticks.</P>
        </Section>

        <Section title="Namespaces">
          <Code>{`namespace core.public

users       # resolves to core.public.users
posts       # resolves to core.public.posts

namespace   # clears the namespace`}</Code>
          <P>
            Up to 3 levels: <C>database.catalog.schema</C>. An explicit namespace on an entity
            overrides the directive.
          </P>
        </Section>

        <Section title="Properties">
          <Code>{`users {color: red, tags: [pii, deprecated]}
  id int pk {autoIncrement}
  name varchar {hidden}

rel posts(author) -> users(id) {onDelete: cascade}`}</Code>
          <P>Key-value metadata in curly braces. Flags (no value) default to true.</P>
        </Section>

        <Section title="Documentation">
          <Code>{`users | storing all users
  email varchar | auth identifier

users |||
  multi-line
  documentation
|||`}</Code>
        </Section>

        <Section title="Comments">
          <Code>{`# This is a comment
users
  id uuid pk  # inline comment`}</Code>
        </Section>

        <Section title="Aliases">
          <Code>{`db1.identity.accounts as users
  id

posts
  author -> users(id)`}</Code>
          <P>Alias an entity for shorter references elsewhere.</P>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  const { monaco, appliedTheme } = useMonaco();
  const [html, setHtml] = useState<string | null>(null);
  const themeColors = getThemeColors(appliedTheme);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-colorize when global Monaco theme changes
  useEffect(() => {
    if (!monaco) return;
    let cancelled = false;
    monaco.editor.colorize(children, AML_LANGUAGE_ID, { tabSize: 2 }).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [monaco, appliedTheme, children]);

  const style = {
    background: themeColors?.background,
    color: themeColors?.foreground,
  };

  if (html) {
    return (
      <pre
        className={styles.code}
        style={style}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted output from monaco.editor.colorize
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <pre className={styles.code} style={style}>
      {children}
    </pre>
  );
}

function C({ children }: { children: React.ReactNode }) {
  return <code className={styles.inline}>{children}</code>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className={styles.paragraph}>{children}</p>;
}

function Tr({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className={styles.cellKey}>
        <code className={styles.inline}>{k}</code>
      </td>
      <td className={styles.cellValue}>{v}</td>
    </tr>
  );
}
