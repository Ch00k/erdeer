import { monaco as amlMonaco } from "@azimutt/aml";
import MonacoEditor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import styles from "./Editor.module.css";

const AML_LANGUAGE_ID = "aml";

interface EditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export function Editor({ value, onChange, readOnly }: EditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [wordWrap, setWordWrap] = useState(true);

  // Keep editor in sync with external value changes (e.g. loading a diagram)
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

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === AML_LANGUAGE_ID)) {
      monaco.languages.register({ id: AML_LANGUAGE_ID });
      monaco.languages.setMonarchTokensProvider(AML_LANGUAGE_ID, amlMonaco.language() as any);
      monaco.languages.registerCompletionItemProvider(
        AML_LANGUAGE_ID,
        amlMonaco.completion() as any,
      );
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>AML</span>
        <button
          className={`${styles.wrapToggle} ${wordWrap ? styles.wrapToggleActive : ""}`}
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
      <div className={styles.editorWrapper}>
        <MonacoEditor
          language={AML_LANGUAGE_ID}
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
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
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
