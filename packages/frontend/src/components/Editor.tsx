import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import styles from "./Editor.module.css";
import { AML_LANGUAGE_ID, useMonaco } from "./monacoContext.js";
import { AUTO_THEME_ID, COMMUNITY_THEMES } from "./monacoThemes.js";

interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  onToggleReference?: () => void;
  referenceOpen?: boolean;
}

export function Editor({
  value,
  onChange,
  readOnly,
  onToggleReference,
  referenceOpen,
}: EditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const { appliedTheme, selection, setSelection } = useMonaco();

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.updateOptions({ wordWrap: wordWrap ? "on" : "off" });
    }
  }, [wordWrap]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>AML</span>
        <div className={styles.headerActions}>
          <select
            className={styles.themeSelect}
            value={selection}
            onChange={(e) => setSelection(e.target.value)}
            title="Editor theme"
          >
            <option value={AUTO_THEME_ID}>Auto (follow app)</option>
            {COMMUNITY_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {onToggleReference && (
            <button
              className={`${styles.headerButton} ${referenceOpen ? styles.headerButtonActive : ""}`}
              onClick={onToggleReference}
              title={referenceOpen ? "Hide AML reference" : "Show AML reference"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            className={`${styles.headerButton} ${wordWrap ? styles.headerButtonActive : ""}`}
            onClick={() => setWordWrap(!wordWrap)}
            title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 6h18M3 12h15a3 3 0 1 1 0 6h-4M16 16l-2 2M16 20l-2-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className={styles.editorWrapper}>
        <MonacoEditor
          language={AML_LANGUAGE_ID}
          theme={appliedTheme}
          value={value}
          onChange={(v) => onChange?.(v ?? "")}
          onMount={handleMount}
          options={{
            readOnly: readOnly ?? false,
            minimap: { enabled: false },
            lineNumbers: "off",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            lineHeight: 20,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
              verticalScrollbarSize: 4,
              horizontalScrollbarSize: 4,
            },
            wordWrap: wordWrap ? "on" : "off",
            tabSize: 2,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
