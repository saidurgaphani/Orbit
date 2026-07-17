import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function PrimaryButton({ children, to, href, onClick, className = '' }) {
  const auth = useAuth();
  
  let targetTo = to;
  if (to === '/app') {
    targetTo = auth?.isAuthenticated ? '/app' : '/auth/login';
  }

  const classes = `inline-block bg-charcoal text-alabaster px-6 py-3 uppercase text-xs font-black tracking-widest hover:bg-forest border border-charcoal shadow-[3px_3px_0px_0px_rgba(30,32,30,1)] hover:shadow-[2px_2px_0px_0px_rgba(55,85,52,1)] hover:-translate-y-0.5 transition-all duration-200 ${className}`;

  if (targetTo) return <Link to={targetTo} className={classes}>{children}</Link>;
  if (href) return <a href={href} className={classes}>{children}</a>;
  return <button type="button" onClick={onClick} className={classes}>{children}</button>;
}

export function SecondaryButton({ children, to, href, onClick, className = '' }) {
  const classes = `inline-block border border-charcoal hover:border-forest text-charcoal hover:text-forest px-6 py-3 text-xs uppercase font-bold tracking-wider transition-colors duration-200 ${className}`;

  if (to) return <Link to={to} className={classes}>{children}</Link>;
  if (href) return <a href={href} className={classes}>{children}</a>;
  return <button type="button" onClick={onClick} className={classes}>{children}</button>;
}
