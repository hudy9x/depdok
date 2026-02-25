import { FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomIconProps {
  className?: string;
  primary?: string;
  secondary?: string;
}

const PlantumlIcon = ({ className, primary = "#737373", secondary = "#A4A4A4" }: CustomIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 8V12" stroke={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 12H18" stroke={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 12V16" stroke={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 12V16" stroke={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 3H9C8.44772 3 8 3.44772 8 4V7C8 7.55228 8.44772 8 9 8H15C15.5523 8 16 7.55228 16 7V4C16 3.44772 15.5523 3 15 3Z" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 16H4C3.44772 16 3 16.4477 3 17V20C3 20.5523 3.44772 21 4 21H8C8.55228 21 9 20.5523 9 20V17C9 16.4477 8.55228 16 8 16Z" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 16H16C15.4477 16 15 16.4477 15 17V20C15 20.5523 15.4477 21 16 21H20C20.5523 21 21 20.5523 21 20V17C21 16.4477 20.5523 16 20 16Z" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MmdIcon = ({ className, primary = "#737373", secondary = "#A4A4A4" }: CustomIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 3L17 10H7L12 3Z" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 15H4C3.44772 15 3 15.4477 3 16V21C3 21.5523 3.44772 22 4 22H9C9.55228 22 10 21.5523 10 21V16C10 15.4477 9.55228 15 9 15Z" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 22C19.933 22 21.5 20.433 21.5 18.5C21.5 16.567 19.933 15 18 15C16.067 15 14.5 16.567 14.5 18.5C14.5 20.433 16.067 22 18 22Z" stroke={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TodoIcon = ({ className, primary = "#737373", secondary = "#A4A4A4" }: CustomIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M13 5H21" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 12H21" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13 19H21" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 17L5 19L9 15" stroke={primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 4H4C3.44772 4 3 4.44772 3 5V9C3 9.55228 3.44772 10 4 10H8C8.55228 10 9 9.55228 9 9V5C9 4.44772 8.55228 4 8 4Z" stroke={secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MarkdownIcon = ({ className, primary = "currentColor" }: CustomIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M20.5 4H3.5C2.1 4 1 5.1 1 6.5V17.5C1 18.9 2.1 20 3.5 20H20.5C21.9 20 23 18.9 23 17.5V6.5C23 5.1 21.9 4 20.5 4ZM5 16V8H7.5L9.5 10.5L11.5 8H14V16H12V11.5L9.5 14.5L7 11.5V16H5ZM18.5 16L15.5 12H17.5V8H19.5V12H21.5L18.5 16Z" fill={primary} />
  </svg>
);

interface FileIconProps {
  filename: string;
  className?: string;
  variant?: 'default' | 'colorful';
}

export function FileIcon({ filename, className, variant = 'colorful' }: FileIconProps) {
  const isColorful = variant === 'colorful';

  const getIcon = () => {
    const isImage = /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(filename);
    if (isImage) return <ImageIcon className={cn("w-4 h-4 text-muted-foreground", className)} />;

    if (filename.endsWith('.todo')) return <TodoIcon className={cn("w-4 h-4", className)} primary={isColorful ? "#3b82f6" : undefined} secondary={isColorful ? "#93c5fd" : undefined} />;
    if (filename.endsWith('.md')) return <MarkdownIcon className={cn("w-4 h-4 text-foreground", className)} />;
    if (filename.endsWith('.mmd')) return <MmdIcon className={cn("w-4 h-4", className)} primary={isColorful ? "#a855f7" : undefined} secondary={isColorful ? "#d8b4fe" : undefined} />;
    if (filename.endsWith('.plantuml') || filename.endsWith('.puml') || filename.endsWith('.pu')) return <PlantumlIcon className={cn("w-4 h-4", className)} primary={isColorful ? "#22c55e" : undefined} secondary={isColorful ? "#86efac" : undefined} />;
    return <FileText className={cn("w-4 h-4 text-muted-foreground", className)} />;
  };

  return getIcon();
}
