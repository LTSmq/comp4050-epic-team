import { CSSProperties } from 'react';

export const containerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "70vh",
  minWidth: "320px",
  minHeight: "480px",
  gap: "16px",
  padding: "16px",
  backgroundColor: "#f9fafb"
};

export const canvasStyle: CSSProperties = {
  width: "100%",
  flex: "1 1 auto",
  minHeight: "360px",
  minWidth: "280px",
  borderRadius: "8px",
  overflow: "hidden"
};

export const controlsPanelStyle: CSSProperties = {
  display: "flex",
  gap: "12px",
  padding: "16px",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  flexWrap: "wrap"
};

export const buttonGroupStyle: CSSProperties = {
  display: "flex",
  gap: "8px"
};

export const buttonStyle: CSSProperties = {
  padding: "10px 16px",
  color: "white",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: "500",
  cursor: "pointer",
  transition: "all 0.3s ease"
};

export const buttonUpStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#3b82f6"
};

export const buttonDownStyle: CSSProperties = {
  ...buttonStyle,
  backgroundColor: "#ef4444"
};
