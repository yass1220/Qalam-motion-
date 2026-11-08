// Draw the existing diagonal icon without relying on Arabic-font glyph coverage.
export function ArrowIcon({down = false}: {down?: boolean}) {
  return (
    <svg aria-hidden="true" focusable="false" width="18" height="18"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{display: "inline-block", verticalAlign: "middle", flexShrink: 0,
        transform: down ? "scaleY(-1)" : undefined}}>
      <path d="M5 19 19 5M5 5h14v14" />
    </svg>
  );
}
