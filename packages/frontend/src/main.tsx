import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { MonacoProvider } from "./components/monacoContext.js";
import { ThemeProvider } from "./theme.js";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <MonacoProvider>
        <App />
      </MonacoProvider>
    </ThemeProvider>
  </StrictMode>,
);
