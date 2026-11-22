'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from './UIComponents';

export function SubmitButton({
  children,
  size = 'md',
  className = '',
}: {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="primary" size={size} className={className} disabled={pending}>
      {pending ? 'Guardando...' : children}
    </Button>
  );
}
