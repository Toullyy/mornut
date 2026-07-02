import type { CSSProperties } from 'react'

export const c = {
  primary: '#06C755',
  primaryDark: '#05a547',
  white: '#ffffff',
  bg: '#f2f2f7',
  card: '#ffffff',
  text: '#111111',
  sub: '#666666',
  border: '#e0e0e0',
  muted: '#aaaaaa',
  danger: '#e53935',
  warn: '#ff9800',
}

export const page: CSSProperties = {
  minHeight: '100dvh',
  background: c.bg,
  fontFamily: "'Noto Sans Thai', system-ui, sans-serif",
  color: c.text,
}

export const section: CSSProperties = {
  padding: '16px 16px 0',
}

export const card: CSSProperties = {
  background: c.card,
  borderRadius: 12,
  padding: '14px 16px',
  marginBottom: 10,
  boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
}

export const cardSelectable = (selected = false): CSSProperties => ({
  ...card,
  cursor: 'pointer',
  border: `2px solid ${selected ? c.primary : 'transparent'}`,
  boxShadow: selected ? `0 0 0 1px ${c.primary}` : card.boxShadow,
})

export const btn = (disabled = false): CSSProperties => ({
  width: '100%',
  padding: '14px 0',
  borderRadius: 12,
  border: 'none',
  background: disabled ? c.muted : c.primary,
  color: c.white,
  fontSize: 16,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: 12,
})

export const btnOutline: CSSProperties = {
  width: '100%',
  padding: '12px 0',
  borderRadius: 12,
  border: `1.5px solid ${c.border}`,
  background: 'transparent',
  color: c.sub,
  fontSize: 15,
  cursor: 'pointer',
  marginTop: 8,
}

export const input: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: `1.5px solid ${c.border}`,
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box',
  background: c.white,
}

export const label: CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: c.sub,
  marginBottom: 6,
  marginTop: 14,
}

export const h2: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  margin: '0 0 4px',
}

export const small: CSSProperties = {
  fontSize: 13,
  color: c.sub,
}
