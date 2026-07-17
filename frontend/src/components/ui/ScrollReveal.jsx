import { useScrollReveal } from '../../landing/hooks/useScrollReveal';

export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
  as: Tag = 'div',
  threshold,
  triggerOnce = true,
}) {
  const { ref, visible } = useScrollReveal({ threshold, triggerOnce });

  const directionClass = {
    up: 'reveal-up',
    down: 'reveal-down',
    left: 'reveal-left',
    right: 'reveal-right',
    fade: 'reveal-fade',
    scale: 'reveal-scale',
  }[direction] || 'reveal-up';

  return (
    <Tag
      ref={ref}
      className={`reveal ${directionClass} ${visible ? 'revealed' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}
