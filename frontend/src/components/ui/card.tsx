import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const cardVariants = cva('rounded-card bg-surface text-ink', {
  variants: {
    variant: {
      default: 'shadow-card hairline',
      soft: 'bg-surfaceWarm shadow-card hairline',
      blue: 'bg-surfaceBlue2 shadow-card hairline',
      shell: 'rounded-core shadow-card hairline',
      plain: 'hairline',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  pressable?: boolean;
}

export function Card({ className, variant, pressable, ...props }: CardProps) {
  return (
    <div
      className={cn(
        cardVariants({ variant }),
        pressable && 'transition-all duration-200 [transition-timing-function:var(--ease)]',
        pressable && 'hover:-translate-y-0.5 hover:shadow-pop',
        pressable && 'active:scale-[.98] active:shadow-card',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-3 p-5 pb-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[15px] font-bold text-ink', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-[13px] text-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-2 p-5 pt-0', className)} {...props} />;
}

export type { VariantProps };
