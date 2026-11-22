export type PaymentMethod = 'EFECTIVO' | 'PSE' | 'NEQUI' | 'DAVPLATA' | 'OTRO';

export type ClientStatus = 'ACTIVO' | 'POR_VENCER' | 'VENCIDO';

export interface Owner {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  age: number | null;
  address: string | null;
  phone: string;
  payment_method: PaymentMethod;
  consent_at: string | null;
  active: boolean;
  created_at: string;
}

export interface MembershipPayment {
  id: string;
  client_id: string;
  amount_cop: number;
  paid_at: string;
  period_start: string | null;
  period_end: string | null;
  recorded_by: string | null;
  note: string | null;
  created_at: string;
}

export interface Attendance {
  id: string;
  client_id: string;
  check_in: string;
  note: string | null;
  recorded_by: string | null;
}

export interface ClientWithStatus extends Client {
  status: ClientStatus;
  last_payment_at: string | null;
  next_expiration: string | null;
  days_left: number | null;
  last_attendance: string | null;
  attendance_this_month: number;
}

export interface DashboardStats {
  total_clients: number;
  active_clients: number;
  expiring_this_week: number;
  expired_clients: number;
  revenue_this_month: number;
  revenue_last_month: number;
  attendance_this_month: number;
  not_returned: ClientWithStatus[];
}

export interface RevenuePoint {
  month: string;
  label: string;
  revenue: number;
  count: number;
}