// The "/export" subpath keeps the AML parser (and the payload placeholder
// literal in the shared barrel) out of the viewer bundle.
import { EXPORT_DATA_ELEMENT_ID, type ExportData } from "@erdeer/shared/export";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../theme.js";
import { Viewer } from "./Viewer.js";
import "../styles/global.css";

function readData(): ExportData | null {
  const el = document.getElementById(EXPORT_DATA_ELEMENT_ID);
  if (!el?.textContent) return null;

  try {
    const parsed: unknown = JSON.parse(el.textContent);
    return parsed && typeof parsed === "object" ? (parsed as ExportData) : null;
  } catch {
    return null;
  }
}

const data = readData();
if (data) {
  document.title = `${data.title || "Untitled diagram"} - ERDeer`;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {data ? (
      <ThemeProvider>
        <Viewer data={data} />
      </ThemeProvider>
    ) : (
      <p style={{ padding: 24 }}>No diagram data is embedded in this file.</p>
    )}
  </StrictMode>,
);
