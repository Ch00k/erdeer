// The export viewer is read-only and never runs auto-layout, so the export
// build aliases elkjs to this stub (see vite.export.config.ts) to keep ELK's
// ~1.4 MB bundle out of the exported HTML file.
export default class ELK {
  layout(): never {
    throw new Error("Auto-layout is not available in exported diagrams");
  }
}
