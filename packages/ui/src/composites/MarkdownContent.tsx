import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/cn';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content?.trim()) return null;

  return (
    <div
      className={cn(
        'text-lg text-foreground leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0',
        '[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-7 [&_li]:my-0.5',
        '[&_strong]:font-semibold [&_em]:italic [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm',
        '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-1.5 [&_h2]:mb-1',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-muted [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
        '[&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:text-sm [&_pre]:overflow-x-auto',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
    >
      <ReactMarkdown>{content.trim()}</ReactMarkdown>
    </div>
  );
}
