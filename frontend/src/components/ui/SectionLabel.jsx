export default function SectionLabel({ children, className = '' }) {
  return (
    <span
      className={`text-xs uppercase font-semibold tracking-wider text-forest ${className}`}
    >
      [ {children} ]
    </span>
  );
}
