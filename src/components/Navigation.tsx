import Link from 'next/link';
import { logoutAction } from '@/app/auth/actions';
import {
  LayoutDashboard,
  CalendarCheck,
  AlertTriangle,
  BarChart3,
  LogOut,
  UserPlus,
  Dumbbell,
} from 'lucide-react';

export function Navigation({ ownerName }: { ownerName?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-ink-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y Nombre del Gimnasio */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-200">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-ink-900 text-lg leading-tight block">
                Gimnasio MVP
              </span>
              <span className="text-xs text-ink-500 font-medium hidden sm:inline">
                Panel de Administración
              </span>
            </div>
          </div>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            <NavigationItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" isActive={false} />
            <NavigationItem href="/attendance" icon={CalendarCheck} label="Asistencia" isActive={false} />
            <NavigationItem href="/expirations" icon={AlertTriangle} label="Vencimientos" isActive={false} />
            <NavigationItem href="/reports" icon={BarChart3} label="Ingresos" isActive={false} />
          </nav>

          {/* Acciones y Perfil */}
          <div className="flex items-center gap-3">
            <Link
              href="/clients/new"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-all shadow-sm shadow-brand-200"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Cliente</span>
            </Link>

            {ownerName && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-ink-100 border border-ink-200">
                <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">
                  {ownerName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-ink-800">{ownerName}</span>
              </div>
            )}

            <form action={logoutAction}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="p-2 rounded-xl text-ink-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Navegación Móvil Inferior */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-ink-200 shadow-lg px-2 py-2">
        <div className="flex justify-around items-center">
          <NavigationItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" isActive={false} />
          <NavigationItem href="/attendance" icon={CalendarCheck} label="Asistencia" isActive={false} />
          <NavigationItem href="/expirations" icon={AlertTriangle} label="Vencimientos" isActive={false} />
          <NavigationItem href="/reports" icon={BarChart3} label="Ingresos" isActive={false} />
        </div>
      </div>
    </header>
  );
}

function NavigationItem({
  href,
  icon: Icon,
  label,
  isActive,
}: {
  href: string;
  icon: any;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-all ${
        isActive ? 'text-brand-600 font-semibold' : 'text-ink-500 hover:text-ink-900'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </Link>
  );
}
