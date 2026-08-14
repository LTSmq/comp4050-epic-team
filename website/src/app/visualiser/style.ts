import type { CSSProperties } from "react";

export const styles: Record<string, CSSProperties> = {
  pageWrapper: {
    minHeight: "100vh", width: "100%", backgroundColor: "#f5f5f7", color: "#1d1d1f",
    display: "flex", flexDirection: "column", position: "relative", overflowX: "hidden",
  },
  mainContent: {
    flex: 1, display: "flex", flexDirection: "column", width: "100%", position: "relative",
  },
};

export default styles;
