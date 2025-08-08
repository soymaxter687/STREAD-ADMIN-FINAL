"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import {
  supabase,
  type Servicio,
  type Cliente,
  type Cuenta,
  type CuentaUsuario,
  type UsuarioAsignacion,
} from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"

interface AppContextType {
  // Estados
  servicios: Servicio[]
  clientes: Cliente[]
  cuentas: Cuenta[]
  cuentaUsuarios: CuentaUsuario[]
  asignaciones: UsuarioAsignacion[]
  loading: boolean

  // Funciones
  refreshData: () => Promise<void>
  refreshServicios: () => Promise<void>
  refreshClientes: () => Promise<void>
  refreshCuentas: () => Promise<void>
  refreshUsuarios: () => Promise<void>
  refreshAsignaciones: () => Promise<void>

  // Estadísticas
  getEstadisticas: () => {
    totalClientes: number
    totalCuentas: number
    totalUsuarios: number
    usuariosOcupados: number
    ingresosMensuales: number
    cuentasVencenProximamente: number
  }
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [cuentaUsuarios, setCuentaUsuarios] = useState<CuentaUsuario[]>([])
  const [asignaciones, setAsignaciones] = useState<UsuarioAsignacion[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const refreshServicios = async () => {
    try {
      const { data, error } = await supabase.from("servicios").select("*").order("nombre")

      if (error) throw error
      setServicios(data || [])
    } catch (error) {
      console.error("Error loading servicios:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los servicios",
        variant: "destructive",
      })
    }
  }

  const refreshClientes = async () => {
    try {
      const { data, error } = await supabase.from("clientes").select("*").order("nombre")

      if (error) throw error
      setClientes(data || [])
    } catch (error) {
      console.error("Error loading clientes:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      })
    }
  }

  const refreshCuentas = async () => {
    try {
      const { data, error } = await supabase
        .from("cuentas")
        .select(`
          *,
          servicio:servicios(*)
        `)
        .order("nombre")

      if (error) throw error
      setCuentas(data || [])
    } catch (error) {
      console.error("Error loading cuentas:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las cuentas",
        variant: "destructive",
      })
    }
  }

  const refreshUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from("cuenta_usuarios")
        .select(`
          *,
          cuenta:cuentas(
            *,
            servicio:servicios(*)
          )
        `)
        .order("id")

      if (error) throw error
      setCuentaUsuarios(data || [])
    } catch (error) {
      console.error("Error loading usuarios:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      })
    }
  }

  const refreshAsignaciones = async () => {
    try {
      const { data, error } = await supabase
        .from("usuarios_asignaciones")
        .select(`
          *,
          cliente:clientes(*),
          cuenta_usuario:cuenta_usuarios(
            *,
            cuenta:cuentas(
              *,
              servicio:servicios(*)
            )
          )
        `)
        .eq("activa", true)
        .order("fecha_asignacion", { ascending: false })

      if (error) throw error
      setAsignaciones(data || [])
    } catch (error) {
      console.error("Error loading asignaciones:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las asignaciones",
        variant: "destructive",
      })
    }
  }

  const refreshData = async () => {
    setLoading(true)
    await Promise.all([
      refreshServicios(),
      refreshClientes(),
      refreshCuentas(),
      refreshUsuarios(),
      refreshAsignaciones(),
    ])
    setLoading(false)
  }

  const getEstadisticas = () => {
    const totalClientes = clientes.filter((c) => c.activo).length
    const totalCuentas = cuentas.filter((c) => c.activa).length
    const totalUsuarios = cuentaUsuarios.length
    const usuariosOcupados = asignaciones.length

    const ingresosMensuales = asignaciones.reduce((total, asignacion) => {
      return total + (asignacion.costo_suscripcion || 0)
    }, 0)

    const hoy = new Date()
    const enUnMes = new Date()
    enUnMes.setMonth(hoy.getMonth() + 1)

    const cuentasVencenProximamente = cuentas.filter((c) => {
      if (!c.fecha_vencimiento || !c.activa) return false
      const vencimiento = new Date(c.fecha_vencimiento)
      return vencimiento >= hoy && vencimiento <= enUnMes
    }).length

    return {
      totalClientes,
      totalCuentas,
      totalUsuarios,
      usuariosOcupados,
      ingresosMensuales,
      cuentasVencenProximamente,
    }
  }

  useEffect(() => {
    refreshData()
  }, [])

  return (
    <AppContext.Provider
      value={{
        servicios,
        clientes,
        cuentas,
        cuentaUsuarios,
        asignaciones,
        loading,
        refreshData,
        refreshServicios,
        refreshClientes,
        refreshCuentas,
        refreshUsuarios,
        refreshAsignaciones,
        getEstadisticas,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
