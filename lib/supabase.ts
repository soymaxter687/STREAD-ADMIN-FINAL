import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos de datos
export interface Cliente {
  id: number
  nombre: string
  telefono: string
  email: string
  codigo?: string
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Servicio {
  id: number
  nombre: string
  descripcion: string
  precio_mensual: number
  emoji: string
  imagen_portada?: string
  usuarios_por_cuenta: number
  pin_requerido: boolean
  activo: boolean
  created_at: string
  updated_at: string
}

export interface ServicioPin {
  id: number
  servicio_id: number
  usuario_numero: number
  pin: string
  nombre_usuario: string
  created_at: string
  updated_at: string
}

export interface Cuenta {
  id: number
  servicio_id: number
  email: string
  password: string
  precio_mensual: number
  activo: boolean
  tipo_cuenta: "individual" | "familiar"
  created_at: string
  updated_at: string
  servicio?: Servicio
}

export interface Usuario {
  id: number
  cuenta_id: number
  cliente_id: number
  usuario_numero: number
  pin?: string
  fecha_contratacion: string
  fecha_vencimiento: string
  activo: boolean
  created_at: string
  updated_at: string
  cuenta?: Cuenta
  cliente?: Cliente
}

export interface ControlFinanciero {
  id: number
  mes: number
  año: number
  ingresos_totales: number
  gastos_totales: number
  ganancia_neta: number
  usuarios_activos: number
  created_at: string
  updated_at: string
}
