'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

interface ClientNavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
}

export function ClientNavItem({ href, icon: Icon, label }: ClientNavItemProps) {
  const pathname = usePathname();
  
  // Determinar si está activo
  // /dashboard o /clients/* son considerados activos para Inicio (/dashboard)
  const isActiva = pathname === href || 
    (href === '/dashboard' && (pathname === href || pathname.startsWith('/clients/')));
  
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-all ${
        isActiva ? 'text-brand-600 font-semibold' : 'text-ink-500 hover:text-ink-900'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="leading-tight">{label}</span>
    </Link>
  );
}