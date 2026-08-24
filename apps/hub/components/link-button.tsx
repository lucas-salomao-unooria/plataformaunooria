'use client';

import Link from 'next/link';

import { Button } from '@edu/ui/ds';

/** Button do Design System renderizado como navegação do Next. */
export function LinkButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}) {
  return (
    <Button as={Link} href={href} variant={variant} size={size} fullWidth={fullWidth}>
      {children}
    </Button>
  );
}
