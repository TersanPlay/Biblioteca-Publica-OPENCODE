import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { FieldError } from './form-field';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Selecione...',
  className,
  disabled,
  error,
}: SelectProps) {
  return (
    <span className="block w-full">
      <SelectPrimitive.Root value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-control bg-surface px-3 text-sm text-ink',
            'shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] transition-all duration-200 [transition-timing-function:var(--ease)]',
            'hover:shadow-[inset_0_0_0_1px_rgba(23,26,26,.18)]',
            'focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]',
            'disabled:bg-canvas disabled:opacity-60',
            !value && 'text-muted/70',
            error && 'shadow-[inset_0_0_0_1.5px_#C03A2B]',
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown className="size-4 text-muted" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
      </SelectPrimitive.Root>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-card border border-black/5 bg-surface p-1 shadow-pop anim-pop"
        >
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-control py-2 pl-3 pr-8 text-sm text-ink',
                  'data-[highlighted]:bg-surfaceBlue data-[state=checked]:text-primary-dark',
                  'focus:outline-none',
                )}
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
      {error && <FieldError message={error} />}
    </span>
  );
}

export function NativeSelect({
  value,
  onChange,
  options,
  className,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <span className="block w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'h-10 w-full appearance-none rounded-control border border-transparent bg-surface px-3 pr-9 text-sm text-ink',
          'shadow-[inset_0_0_0_1px_rgba(23,26,26,.1)] transition-all duration-200 [transition-timing-function:var(--ease)]',
          'hover:shadow-[inset_0_0_0_1px_rgba(23,26,26,.18)]',
          'focus:outline-none focus:shadow-[inset_0_0_0_2px_#087F8C]',
          'disabled:bg-canvas disabled:opacity-60',
          error && 'shadow-[inset_0_0_0_1.5px_#C03A2B]',
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23687170' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <FieldError message={error} />}
    </span>
  );
}
