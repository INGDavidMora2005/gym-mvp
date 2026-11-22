# 🏋️‍♂️ Gimnasio MVP - Sistema de Gestión Administrativa

Sistema de gestión web privado diseñado para la administración eficiente de un gimnasio de sede única. Esta aplicación permite a los tres administradores/dueños (Padre, Esposa e Hija) gestionar clientes, controlar la asistencia diaria, realizar seguimiento a vencimientos con tarifa fija ($65.000 COP), consultar ingresos con gráficos interactivos y enviar recordatorios directa y rápidamente a través de WhatsApp.

---

## 📌 Contexto del Proyecto

El gimnasio opera con un modelo de **tarifa plana mensual de $65.000 COP** sin cobros automáticos; los usuarios renuevan su membresía presencialmente en recepción.

La aplicación resuelve las necesidades clave de operación diaria:
1. **Control de Afiliación:** Cálculo automático de estado de membresía (`ACTIVO`, `POR_VENCER`, `VENCIDO`) según la fecha del último pago.
2. **Control de Asistencia:** Marcado rápido de ingresos diarios para registrar constancia y calcular frecuencia de visitas.
3. **Estrategia de Retención:** Detección de usuarios activos que pagaron pero llevan más de 14 días sin asistir, habilitando un botón para motivarlos vía WhatsApp.
4. **Mensajería Semiautomática:** Generación de mensajes pre-armados para recordatorios de vencimiento y bienvenida enviados con un clic a WhatsApp.
5. **Transparencia Financiera:** Registro de quién cobró cada mensualidad y reporte visual de ingresos históricos (últimos 6 meses).

---

## ✨ Características Principales

- 🔐 **Autenticación Privada:** Acceso exclusivo mediante credenciales para los 3 dueños.
- 👥 **Gestión de Clientes (CRUD):** Registro completo con nombre, edad, dirección, teléfono y método de pago habitual (Efectivo, Nequi, Daviplata, PSE). Eliminación lógica de clientes.
- 📅 **Control de Asistencia Diaria:** Vista rápida para marcar las entradas del día con conteo en tiempo real.
- ⚠️ **Módulo de Vencimientos:** Listado ordenado por urgencia con recordatorios inmediatos por WhatsApp.
- 💬 **Integración con WhatsApp (`wa.me`):** Plantillas de mensaje inteligentes (bienvenida, aviso de vencimiento, reactivación) precargadas directamente en la app oficial.
- 📊 **Reportes e Ingresos:** Gráficos estadísticos con Recharts y métricas comparativas entre meses.
- 📱 **Diseño Responsive & UI/UX Optimizado:** Interfaz limpia con Tailwind CSS, animaciones suaves y navegación adaptada a dispositivos móviles.

---

## 🛠️ Stack Tecnológico

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions)
- **Lenguaje:** TypeScript
- **Estilos & UI:** Tailwind CSS, Lucide React (íconos)
- **Gráficos:** Recharts
- **Base de Datos & Backend:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Autenticación & Seguridad:** Supabase Auth + `@supabase/ssr` (sesión en cookies + middleware)

---

## 📁 Estructura del Proyecto

```text
gym-app/
├── sql/
│   └── schema.sql            # Script SQL de tablas, índices y vistas para Supabase
├── src/
│   ├── app/
│   │   ├── auth/login/       # Pantalla de inicio de sesión (Server Action)
│   │   ├── clients/          # Fichas de cliente (alta, edición, historial)
│   │   ├── dashboard/        # Dashboard principal con métricas e indicadores
│   │   ├── expirations/      # Vista de alertas de vencimientos
│   │   ├── reports/          # Reportes financieros y gráficos de ingresos
│   │   ├── globals.css       # Configuración global de estilos
│   │   └── layout.tsx        # Layout principal de la aplicación
│   ├── components/
│   │   ├── ClientList.tsx    # Componente interactivo de búsqueda y filtrado
│   │   ├── Navigation.tsx    # Barra de navegación responsive (Desktop/Mobile)
│   │   ├── RevenueChart.tsx  # Gráfico de barras de ingresos
│   │   └── UIComponents.tsx  # Componentes reutilizables (Card, Button, StatusBadge)
│   ├── lib/
│   │   ├── auth.ts           # Helpers de verificación de dueños y sesión
│   │   ├── db.ts             # Consultas de métricas, ingresos e historial
│   │   ├── supabase.ts       # Cliente Supabase en servidor (Service Role)
│   │   ├── supabase-client.ts# Cliente Supabase en navegador
│   │   └── utils.ts          # Formateo COP, fechas y generador de mensajes WhatsApp
│   └── types/
│       └── index.ts          # Interfaces y tipos del dominio
├── .env.example              # Plantilla de variables de entorno
├── next.config.js            # Configuración de Next.js
├── tailwind.config.js        # Configuración de Tailwind CSS
└── package.json              # Dependencias y scripts de NPM
```

---

## ⚙️ Requisitos Previos

- [Node.js](https://nodejs.org/) v18.17 o superior.
- Cuenta en [Supabase](https://supabase.com/) (Plan Gratuito).
- Gestor de paquetes `npm` (incluido en Node.js).

---

## 🚀 Guía de Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU_USUARIO/gym-mvp.git
cd gym-mvp
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env.local` en la raíz del proyecto basándote en `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica
SUPABASE_SERVICE_ROLE_KEY=tu-clave-secreta
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Nota:** Puedes obtener las llaves en Supabase desde **Settings > API Keys**.
> La clave pública (anon/publishable) se usa en el navegador y el middleware; la secreta
> (service_role/secret) solo en el servidor. Si rotas las llaves, actualiza **ambas**.

---

### 4. Configurar la Base de Datos en Supabase

1. Ve al panel de Supabase → **SQL Editor**.
2. Copia y ejecuta el contenido del archivo `sql/schema.sql`. Esto creará las tablas:
   - `owners`
   - `clients`
   - `membership_payments`
   - `attendance`
3. Crea los dueños en **Authentication > Users** (email + contraseña). Después registra
   esos mismos usuarios en la tabla `owners`, usando el mismo email:

```sql
insert into owners (id, name, email)
select id, split_part(email, '@', 1), email
from auth.users
where email in ('padre@ejemplo.com', 'esposa@ejemplo.com', 'hija@ejemplo.com');
```

> El login lo gestiona Supabase Auth; `owners` solo define quién tiene acceso al panel.

---

### 5. Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

Abre tu navegador en [http://localhost:3000](http://localhost:3000) e ingresa con el correo y contraseña configurados.

---

## 🛠️ Scripts Disponibles

- `npm run dev`: Ejecuta el entorno de desarrollo.
- `npm run build`: Compila el proyecto para producción.
- `npm run start`: Inicia el servidor de producción previamente compilado.
- `npm run lint`: Ejecuta el linter de código.

---

## 🤝 Convenciones de Commits

En este repositorio seguimos las convenciones de **Conventional Commits**:
- `feat:` Nuevas funcionalidades.
- `fix:` Corrección de errores.
- `docs:` Cambios en documentación (`README.md`).
- `style:` Formato o estilos sin cambio de lógica.
- `refactor:` Refactorización de código.

---

## 📄 Licencia

Este proyecto es privado y de propiedad exclusiva de los administradores del gimnasio.
