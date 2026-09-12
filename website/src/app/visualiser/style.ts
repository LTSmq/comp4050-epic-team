import type { CSSProperties } from "react";

export const styles: Record<string, CSSProperties> = {
  pageWrapper: {
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#f5f5f7",
    color: "#1d1d1f",
    display: "flex",
    flexDirection: "column",
  },

  mainContent: {
    flex: 1,
    width: "100%",
  },

  visualiserWorkspace: {
    width: "min(1200px, 92%)",
    margin: "0 auto",
    padding: "48px 0",
  },

  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
  },

  eyebrow: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#0046ba",
  },

  orderTitle: {
    margin: "6px 0",
    fontSize: "36px",
  },

  orderSubtitle: {
    margin: 0,
    color: "#667085",
  },

  backButton: {
    textDecoration: "none",
    padding: "10px 16px",
    borderRadius: "8px",
    background: "#0046ba",
    color: "#fff",
    fontWeight: 600,
  },

  visualiserGrid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: "24px",
  },

  itemPanel: {
    background: "#fff",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(0,0,0,0.08)",
  },

  visualiserPanel: {
    minHeight: "500px",
    background: "#fff",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(0,0,0,0.08)",
  },

  panelTitle: {
    marginTop: "8px",
  },

  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    padding: "16px 0",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  },

  itemReference: {
    margin: "4px 0 0",
    color: "#667085",
  },

  placeholderText: {
    color: "#667085",
  },

  emptyState: {
    margin: "80px auto",
    textAlign: "center",
  },
};

export default styles;