import styles from "./AmlCode.module.css";

// Mirrors the Monarch grammar the Monaco editor uses (@azimutt/aml,
// src/extensions/monaco.ts) - keep the rules and their order in sync.
// Importing the grammar from the package would pull the whole AML parser
// (~630 kB) into the export bundle, so the rules are copied instead. Sticky
// regexes let each rule be tried at an arbitrary offset; "^"-anchored rules
// then only match at line start (each line is tokenized on its own), and the
// grammar's ignoreCase becomes the "i" flag.
interface Rule {
  regex: RegExp;
  className?: string;
}

const rules: Rule[] = [
  { regex: /^[a-zA-Z_][a-zA-Z0-9_#]*/iy, className: styles.entity },
  { regex: /^ +[a-zA-Z_][a-zA-Z0-9_#]*/iy, className: styles.attribute },
  {
    regex:
      /\b(uuid|(var|n)?char2?|character( +varying)?|(tiny|medium|long|ci)?text|(tiny|small|big)?int(eger)?(\d+)?|numeric|float|double( +precision)?|bool(ean)?|timestamp( +with(out)? +time +zone)?|date(time)?|time( +with(out)? +time +zone)?|interval|json|string|number)\b/iy,
    className: styles.type,
  },
  {
    regex: /\b(namespace|nullable|pk|index|unique|check|fk|rel|type)\b/iy,
    className: styles.keyword,
  },
  { regex: /(->|fk) [^ ]+/iy, className: styles.operators },
  { regex: /\|[^#\n]*/iy, className: styles.commentDoc },
  { regex: /#.*/iy, className: styles.comment },
];

interface Segment {
  text: string;
  className?: string;
}

function matchAt(line: string, pos: number): Segment | null {
  for (const rule of rules) {
    rule.regex.lastIndex = pos;
    const match = rule.regex.exec(line);
    if (match && match[0].length > 0) {
      return { text: match[0], className: rule.className };
    }
  }

  return null;
}

// Monarch semantics: at each offset the first matching rule wins and consumes
// its match; unmatched characters pass through as plain text.
function tokenizeLine(line: string): Segment[] {
  const segments: Segment[] = [];
  let plain = "";
  let pos = 0;

  const flushPlain = () => {
    if (plain) {
      segments.push({ text: plain });
      plain = "";
    }
  };

  while (pos < line.length) {
    const match = matchAt(line, pos);
    if (match) {
      flushPlain();
      segments.push(match);
      pos += match.text.length;
    } else {
      plain += line[pos];
      pos += 1;
    }
  }
  flushPlain();

  return segments;
}

export function AmlCode({ aml }: { aml: string }) {
  return (
    <pre className={styles.code}>
      {aml.split("\n").map((line, lineIndex) => (
        // Content is static, so index keys can never mismatch across renders.
        // biome-ignore lint/suspicious/noArrayIndexKey: static content
        <span key={lineIndex}>
          {tokenizeLine(line).map((seg, segIndex) =>
            seg.className ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static content
              <span key={segIndex} className={seg.className}>
                {seg.text}
              </span>
            ) : (
              seg.text
            ),
          )}
          {"\n"}
        </span>
      ))}
    </pre>
  );
}
