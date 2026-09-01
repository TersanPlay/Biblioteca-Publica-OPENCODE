import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { FieldError } from './form-field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <span className="block w-full">
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-control border border-transparent bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70',
          'shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] transition-all duration-200 [transition-timing-function:var(--ease)]',
          'hover:shadow-[inset_0_0_0_1px_rgba(23,26,26,.18)]',
          'focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]',
          error && 'shadow-[inset_0_0_0_1.5px_#C03A2B]',
          className,
        )}
        {...props}
      />
      {error && <FieldError message={error} />}
    </span>
  ),
);
Textarea.displayName = 'Textarea';
