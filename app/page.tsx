"use client"

import { TabsContent } from "@/components/ui/tabs"

import type React from "react"

import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useApp } from "@/contexts/app-context"
import { Users, CreditCard, Activity, Target, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { formatearNombreCuenta } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ServiciosTab } from "@/components/servicios-tab"
import { CuentasTab } from "@/components/cuentas-tab"
import { ClientesTab } from "@/components/clientes-tab"
import { UsuariosTab } from "@/components/usuarios-tab"
import { ControlFinanciero } from "@/components/control-financiero"
import { DollarSign, TrendingUp, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default function Dashboard() {
  const {
    servicios,
    cuentas,
    clientes,
    asignaciones,
    refreshClientes,
    refreshCuentas,
    refreshData,
    loading,
    getEstadisticas,
    cuentaUsuarios,
  } = useApp()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("dashboard")
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false)
  const [cuentaDialogOpen, setCuentaDialogOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [syncingSheets, setSyncingSheets] = useState(false)
  const [clienteForm, setClienteForm] = useState({
    nombre: "",
    telefono: "+52",
    email: "",
    codigo: "",
  })
  const [cuentaForm, setCuentaForm] = useState({
    servicio_id: "",
    numero_cuenta: "",
    email: "",
    password: "",
    fecha_vencimiento: "",
    precio_base: "",
    precio_cliente: "",
    tipo_cuenta: "compartida",
    activa: true,
  })
  const [numeroError, setNumeroError] = useState("")
  const [codigoError, setCodigoError] = useState("")

  // Función para obtener fecha en zona horaria de Campeche, México
  const getFechaCampeche = (date?: Date) => {
    const fechaBase = date || new Date()
    // Campeche, México está en UTC-6 (CST)
    const fechaCampeche = new Date(fechaBase.toLocaleString("en-US", { timeZone: "America/Merida" }))
    return fechaCampeche
  }

  // Función para formatear fecha como YYYY-MM-DD en zona horaria de Campeche
  const formatearFechaCampeche = (date: Date) => {
    const fechaCampeche = getFechaCampeche(date)
    const year = fechaCampeche.getFullYear()
    const month = String(fechaCampeche.getMonth() + 1).padStart(2, "0")
    const day = String(fechaCampeche.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // Función para obtener fecha un mes después en zona horaria de Campeche
  const getFechaUnMesDespues = () => {
    const hoy = getFechaCampeche()
    const unMesDespues = new Date(hoy)
    unMesDespues.setMonth(unMesDespues.getMonth() + 1)
    return formatearFechaCampeche(unMesDespues)
  }

  // Refrescar datos cuando cambie de pestaña
  useEffect(() => {
    refreshData()
  }, [activeTab])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshData()

    // Also sync with Google Sheets after refreshing local data
    await handleSyncGoogleSheets()

    setRefreshing(false)
  }

  const handleSyncGoogleSheets = async () => {
    setSyncingSheets(true)

    try {
      console.log("Iniciando sincronización con Google Sheets...")

      // Obtener datos completos de usuarios
      const usuariosCompletos = cuentaUsuarios
        .map((usuario) => {
          const cuenta = cuentas.find((c) => c.id === usuario.cuenta_id)
          const servicio = servicios.find((s) => s.id === usuario.servicio_id)
          const asignacion = asignaciones?.find((a) => a.cuenta_usuario_id === usuario.id && a.activa)
          const cliente = asignacion ? clientes?.find((c) => c.id === asignacion.cliente_id) : null

          return {
            ...usuario,
            cuenta,
            servicio,
            asignacion,
            cliente,
            fecha_vencimiento_usuario: asignacion?.fecha_vencimiento_usuario,
            nombre_perfil: asignacion?.nombre_perfil || `Usuario ${usuario.usuario_numero}`,
            pin_asignado: asignacion?.pin_asignado || usuario.pin,
            costo_suscripcion: asignacion?.costo_suscripcion,
            ocupado: usuario.ocupado,
          }
        })
        .filter((usuario) => usuario.cuenta && usuario.servicio && usuario.cuenta.activa)

      // Formatear datos para Google Sheets
      const sheetsData = usuariosCompletos.map((usuario) => ({
        Nombre: usuario.cliente?.nombre || "Usuario Libre",
        Telefono: usuario.cliente?.telefono || "",
        "Correo Cuenta": usuario.cuenta?.email || "",
        Contraseña: usuario.cuenta?.password || "",
        Servicio: usuario.servicio?.nombre || "",
        Usuario: usuario.nombre_perfil || "",
        "Fecha Vencimiento": usuario.fecha_vencimiento_usuario
          ? new Date(usuario.fecha_vencimiento_usuario + "T00:00:00").toLocaleDateString("es-MX")
          : "",
        PIN: usuario.pin_asignado || "",
        Codigo: usuario.cliente?.codigo || "",
        Precio: usuario.ocupado ? `$${usuario.costo_suscripcion?.toFixed(2) || "0.00"}` : "$0.00",
        "Correo Cliente": usuario.cliente?.email || "",
      }))

      console.log("Datos a enviar:", sheetsData)
      console.log("Total de registros:", sheetsData.length)

      // Crear la URL con los parámetros
      const baseUrl =
        "https://script.google.com/macros/s/AKfycbxU0Q2nWtZITl2OScZCD1vNhAlFJqyFC4qbpC8oqm3oinsqTYplkJdm32IB5I1qGLiO/exec"
      const params = new URLSearchParams()
      params.append("action", "updateSheet")
      params.append("data", JSON.stringify(sheetsData))

      const fullUrl = `${baseUrl}?${params.toString()}`

      console.log("URL construida:", fullUrl.substring(0, 200) + "...")

      // Método 1: Usar fetch con modo cors
      try {
        const response = await fetch(fullUrl, {
          method: "GET",
          mode: "cors",
          headers: {
            Accept: "text/plain",
          },
        })

        if (response.ok) {
          const result = await response.text()
          console.log("Respuesta del servidor:", result)

          toast({
            title: "✅ Sincronización exitosa",
            description: `Lista actualizada en Google Sheets (${sheetsData.length} registros)`,
          })
          setSyncingSheets(false)
          return
        }
      } catch (fetchError) {
        console.log("Fetch falló, intentando con iframe...", fetchError)
      }

      // Método 2: Fallback con iframe si fetch falla
      const iframe = document.createElement("iframe")
      iframe.style.display = "none"
      iframe.style.width = "1px"
      iframe.style.height = "1px"
      document.body.appendChild(iframe)

      let timeoutId: NodeJS.Timeout

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId)
        if (iframe.parentNode) {
          document.body.removeChild(iframe)
        }
      }

      // Configurar timeout
      timeoutId = setTimeout(() => {
        cleanup()
        toast({
          title: "✅ Sincronización completada",
          description: `Datos enviados a Google Sheets (${sheetsData.length} registros)`,
        })
        setSyncingSheets(false)
      }, 5000) // 5 segundos

      // Configurar eventos del iframe
      iframe.onload = () => {
        console.log("Iframe cargado exitosamente")
        cleanup()
        toast({
          title: "✅ Sincronización exitosa",
          description: `Lista actualizada en Google Sheets (${sheetsData.length} registros)`,
        })
        setSyncingSheets(false)
      }

      iframe.onerror = () => {
        console.error("Error en iframe")
        cleanup()
        toast({
          title: "⚠️ Sincronización completada",
          description: `Datos enviados (${sheetsData.length} registros). Verifica Google Sheets.`,
        })
        setSyncingSheets(false)
      }

      // Iniciar la carga del iframe
      console.log("Cargando iframe...")
      iframe.src = fullUrl
    } catch (error: any) {
      console.error("Error en sincronización:", error)
      toast({
        title: "❌ Error de sincronización",
        description: `Error: ${error.message}`,
        variant: "destructive",
      })
      setSyncingSheets(false)
    }
  }

  const resetCuentaForm = () => {
    setCuentaForm({
      servicio_id: "",
      numero_cuenta: "",
      email: "",
      password: "",
      fecha_vencimiento: "",
      precio_base: "",
      precio_cliente: "",
      tipo_cuenta: "compartida",
      activa: true,
    })
    setNumeroError("")
  }

  const handleServicioChange = (servicioId: string) => {
    const id = Number.parseInt(servicioId)
    const proximoNumero = getProximoNumeroDisponible(id)

    setCuentaForm((prev) => ({
      ...prev,
      servicio_id: servicioId,
      numero_cuenta: proximoNumero,
    }))

    // Validar el número automático
    validarNumero(servicioId, proximoNumero)

    const servicio = servicios.find((s) => s.id === id)
    if (servicio) {
      // Generar email recomendado basado en el formato del servicio
      let emailRecomendado = ""
      if (servicio.formato_correo) {
        const atIndex = servicio.formato_correo.indexOf("@")
        if (atIndex !== -1) {
          const beforeAt = servicio.formato_correo.substring(0, atIndex)
          const afterAt = servicio.formato_correo.substring(atIndex)
          emailRecomendado = `${beforeAt}${proximoNumero}${afterAt}`
        }
      }

      // Generar contraseña recomendada basada en el nombre del servicio + 6 números aleatorios
      const nombreServicio = servicio.nombre
        .toLowerCase()
        .split(" ")[0]
        .replace(/[^a-z0-9]/g, "")
      const numerosAleatorios = Math.floor(100000 + Math.random() * 900000) // Genera 6 dígitos
      const passwordRecomendada = `${nombreServicio}${numerosAleatorios}`

      setCuentaForm((prev) => ({
        ...prev,
        precio_base: servicio.precio_mensual.toString(),
        precio_cliente: (servicio.precio_mensual * 1.2).toString(),
        email: emailRecomendado,
        password: passwordRecomendada,
      }))
    }
  }

  const handleNumeroChange = (numero: string) => {
    setCuentaForm((prev) => ({ ...prev, numero_cuenta: numero }))

    // Validar el número
    validarNumero(cuentaForm.servicio_id, numero)

    // Regenerar email y contraseña recomendados cuando cambia el número
    if (cuentaForm.servicio_id) {
      const servicio = servicios.find((s) => s.id === Number.parseInt(cuentaForm.servicio_id))
      if (servicio) {
        // Regenerar email
        if (servicio.formato_correo) {
          const atIndex = servicio.formato_correo.indexOf("@")
          if (atIndex !== -1) {
            const beforeAt = servicio.formato_correo.substring(0, atIndex)
            const afterAt = servicio.formato_correo.substring(atIndex)
            const emailRecomendado = `${beforeAt}${numero}${afterAt}`
            setCuentaForm((prev) => ({ ...prev, email: emailRecomendado }))
          }
        }

        // Regenerar contraseña
        const nombreServicio = servicio.nombre
          .toLowerCase()
          .split(" ")[0]
          .replace(/[^a-z0-9]/g, "")
        const numerosAleatorios = Math.floor(100000 + Math.random() * 900000)
        const passwordRecomendada = `${nombreServicio}${numerosAleatorios}`
        setCuentaForm((prev) => ({ ...prev, password: passwordRecomendada }))
      }
    }
  }

  const adjustPrice = (field: "precio_base" | "precio_cliente", increment: boolean) => {
    const currentValue = Number.parseFloat(cuentaForm[field]) || 0
    const newValue = increment ? currentValue + 10 : Math.max(0, currentValue - 10)

    setCuentaForm((prev) => ({
      ...prev,
      [field]: newValue.toString(),
    }))
  }

  const handleClienteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate codigo length
    if (clienteForm.codigo.length !== 4) {
      setCodigoError("El código debe tener exactamente 4 dígitos")
      return
    }

    try {
      const { error } = await supabase.from("clientes").insert([clienteForm])

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Cliente agregado correctamente",
      })

      setClienteForm({ nombre: "", telefono: "+52", email: "", codigo: "" })
      setCodigoError("")
      setClienteDialogOpen(false)
      await refreshClientes()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al agregar cliente",
        variant: "destructive",
      })
    }
  }

  const handleCuentaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const servicioId = Number.parseInt(cuentaForm.servicio_id)
      const numero = cuentaForm.numero_cuenta || "1"

      // Validación final antes de enviar
      if (!validarNumero(cuentaForm.servicio_id, numero)) {
        return // El error ya está mostrado
      }

      // Verificar si el número ya existe (doble verificación)
      if (verificarNumeroExiste(servicioId, numero)) {
        const servicio = servicios.find((s) => s.id === servicioId)
        const nombreFormateado = formatearNombreCuenta(servicio?.nombre || "")
        toast({
          title: "Error",
          description: `Ya existe una cuenta ${nombreFormateado.toUpperCase()}-${numero}`,
          variant: "destructive",
        })
        return
      }

      const servicio = servicios.find((s) => s.id === servicioId)
      if (!servicio) {
        toast({
          title: "Error",
          description: "Servicio no encontrado",
          variant: "destructive",
        })
        return
      }

      const nombreFormateado = formatearNombreCuenta(servicio.nombre)
      const nombreCompleto = `${nombreFormateado.toUpperCase()}-${numero}`

      const dataToSubmit = {
        servicio_id: servicioId,
        nombre: nombreCompleto,
        email: cuentaForm.email,
        password: cuentaForm.password,
        fecha_vencimiento: cuentaForm.fecha_vencimiento || null,
        precio_mensual: Number.parseFloat(cuentaForm.precio_base) || servicio.precio_mensual,
        precio_base: Number.parseFloat(cuentaForm.precio_base) || servicio.precio_mensual,
        precio_cliente:
          Number.parseFloat(cuentaForm.precio_cliente) ||
          Number.parseFloat(cuentaForm.precio_base) * 1.2 ||
          servicio.precio_mensual * 1.2,
        tipo_cuenta: cuentaForm.tipo_cuenta,
        activa: cuentaForm.activa,
      }

      // Crear la cuenta
      const { data: cuentaCreada, error: errorCuenta } = await supabase
        .from("cuentas")
        .insert([dataToSubmit])
        .select()
        .single()

      if (errorCuenta) throw errorCuenta

      // Limpiar cualquier usuario existente (por seguridad)
      await supabase.from("cuenta_usuarios").delete().eq("cuenta_id", cuentaCreada.id)

      // Crear usuarios según el tipo de cuenta
      const cantidadUsuarios =
        cuentaForm.tipo_cuenta === "privada"
          ? 1
          : cuentaForm.tipo_cuenta === "estandar"
            ? 4
            : servicio.usuarios_por_cuenta || 4
      const usuariosData = []

      for (let i = 1; i <= cantidadUsuarios; i++) {
        usuariosData.push({
          cuenta_id: cuentaCreada.id,
          servicio_id: servicioId,
          usuario_numero: i,
          nombre_usuario: `Usuario ${i}`,
          pin: null,
          ocupado: false,
        })
      }

      // Insertar usuarios con manejo de errores mejorado
      const { error: errorUsuarios } = await supabase.from("cuenta_usuarios").insert(usuariosData)

      if (errorUsuarios) {
        console.error("Error al crear usuarios:", errorUsuarios)
        // Si falla la creación de usuarios, eliminar la cuenta creada
        await supabase.from("cuentas").delete().eq("id", cuentaCreada.id)
        throw new Error(`Error al crear los perfiles de usuario: ${errorUsuarios.message}`)
      }

      toast({
        title: "Éxito",
        description: `Cuenta ${cuentaForm.tipo_cuenta} creada correctamente con ${cantidadUsuarios} ${cantidadUsuarios === 1 ? "perfil" : "perfiles"}.`,
      })

      await refreshCuentas()
      setCuentaDialogOpen(false)
      resetCuentaForm()
    } catch (error: any) {
      console.error("Error al crear cuenta:", error)
      toast({
        title: "Error",
        description: error.message || "Error al guardar la cuenta",
        variant: "destructive",
      })
    }
  }

  const getProximoNumeroDisponible = (servicioId: number) => {
    const cuentasDelServicio = cuentas.filter((c) => c.servicio_id === servicioId)
    const numerosUsados = cuentasDelServicio
      .map((c) => {
        const partes = c.nombre.split("-")
        return Number.parseInt(partes[1]) || 1
      })
      .sort((a, b) => a - b)

    // Encontrar el primer número disponible empezando desde 1
    for (let i = 1; i <= numerosUsados.length + 1; i++) {
      if (!numerosUsados.includes(i)) {
        return i.toString()
      }
    }
    return "1"
  }

  // Función para verificar si un número ya existe
  const verificarNumeroExiste = (servicioId: number, numero: string) => {
    const servicio = servicios.find((s) => s.id === servicioId)
    if (!servicio) return false

    const nombreFormateado = formatearNombreCuenta(servicio.nombre)
    const nombreCompleto = `${nombreFormateado.toUpperCase()}-${numero}`

    return cuentas.some((c) => c.nombre === nombreCompleto && c.servicio_id === servicioId)
  }

  // Función para validar número en tiempo real
  const validarNumero = (servicioId: string, numero: string) => {
    if (!servicioId || !numero) {
      setNumeroError("")
      return true
    }

    const id = Number.parseInt(servicioId)
    const servicio = servicios.find((s) => s.id === id)

    if (!servicio) {
      setNumeroError("")
      return true
    }

    if (verificarNumeroExiste(id, numero)) {
      const nombreFormateado = formatearNombreCuenta(servicio.nombre)
      setNumeroError(`La cuenta ${nombreFormateado.toUpperCase()}-${numero} ya existe`)
      return false
    }

    setNumeroError("")
    return true
  }

  const estadisticas = getEstadisticas()

  const serviciosMasUtilizados = servicios
    .filter((s) => s.activo)
    .map((servicio) => {
      const usuariosDelServicio = asignaciones.filter(
        (a) => a.cuenta_usuario?.cuenta?.servicio_id === servicio.id,
      ).length

      return {
        ...servicio,
        usuariosAsignados: usuariosDelServicio,
      }
    })
    .sort((a, b) => b.usuariosAsignados - a.usuariosAsignados)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando StreamAdmin...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Enhanced Header with Integrated Tabs */}
        <div className="relative mb-8">
          {/* Background with animated gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-3xl opacity-90"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent rounded-3xl"></div>

          {/* Decorative elements */}
          <div className="absolute top-4 left-4 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-4 right-4 w-16 h-16 bg-yellow-300/20 rounded-full blur-lg"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>

          {/* Content */}
          <div className="relative px-4 py-8">
            {/* Top section with title and button */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-6">
                {/* Logo/Icon with animation */}
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-2xl transform hover:scale-110 transition-all duration-300">
                    <div className="text-3xl animate-bounce">🎬</div>
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                </div>

                {/* Title and subtitle with enhanced styling */}
                <div className="space-y-1">
                  <h1 className="text-4xl font-black text-white tracking-tight bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent drop-shadow-2xl">
                    Stream<span className="text-yellow-300">Admin</span>
                  </h1>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                    <p className="text-blue-100 text-lg font-semibold tracking-wide">
                      Sistema de Gestión de Servicios Digitales
                    </p>
                  </div>
                </div>
              </div>

              {/* Action button with enhanced styling */}
              <div className="flex flex-col items-end space-y-2">
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing || syncingSheets}
                  className="bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-sm border border-white/30 text-white hover:from-white/30 hover:to-white/20 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:scale-105 hover:-translate-y-1"
                  size="lg"
                >
                  <RefreshCw className={`h-5 w-5 mr-3 ${refreshing || syncingSheets ? "animate-spin" : ""}`} />
                  {syncingSheets ? "Sincronizando..." : refreshing ? "Actualizando..." : "Actualizar"}
                </Button>

                {/* Status indicators */}
                <div className="flex items-center space-x-2 text-white/80 text-sm">
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{estadisticas.totalClientes}</span>
                  </div>
                  <div className="w-1 h-1 bg-white/50 rounded-full"></div>
                  <div className="flex items-center space-x-1">
                    <CreditCard className="h-4 w-4" />
                    <span>{estadisticas.totalCuentas}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Integrated Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="relative grid w-full grid-cols-5 h-14 bg-white/10 backdrop-blur-sm rounded-2xl p-2 shadow-xl border border-white/20">
                <TabsTrigger
                  value="dashboard"
                  className="relative overflow-hidden rounded-xl hover:bg-white/20 text-white font-bold transition-all duration-300 hover:shadow-lg hover:scale-105 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=active]:scale-105 group"
                >
                  <div className="flex items-center space-x-2 relative z-10">
                    <Activity className="h-4 w-4 group-hover:animate-pulse" />
                    <span className="text-sm font-black tracking-wide">Inicio</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="cuentas"
                  className="relative overflow-hidden rounded-xl hover:bg-white/20 text-white font-bold transition-all duration-300 hover:shadow-lg hover:scale-105 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=active]:scale-105 group"
                >
                  <div className="flex items-center space-x-2 relative z-10">
                    <CreditCard className="h-4 w-4 group-hover:animate-pulse" />
                    <span className="text-sm font-black tracking-wide">Cuentas</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="usuarios"
                  className="relative overflow-hidden rounded-xl hover:bg-white/20 text-white font-bold transition-all duration-300 hover:shadow-lg hover:scale-105 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=active]:scale-105 group"
                >
                  <div className="flex items-center space-x-2 relative z-10">
                    <Users className="h-4 w-4 group-hover:animate-pulse" />
                    <span className="text-sm font-black tracking-wide">Usuarios</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="clientes"
                  className="relative overflow-hidden rounded-xl hover:bg-white/20 text-white font-bold transition-all duration-300 hover:shadow-lg hover:scale-105 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=active]:scale-105 group"
                >
                  <div className="flex items-center space-x-2 relative z-10">
                    <Target className="h-4 w-4 group-hover:animate-pulse" />
                    <span className="text-sm font-black tracking-wide">Clientes</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="servicios"
                  className="relative overflow-hidden rounded-xl hover:bg-white/20 text-white font-bold transition-all duration-300 hover:shadow-lg hover:scale-105 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=active]:scale-105 group"
                >
                  <div className="flex items-center space-x-2 relative z-10">
                    <div className="text-lg group-hover:animate-bounce">⚙️</div>
                    <span className="text-sm font-black tracking-wide">Servicios</span>
                  </div>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-4">
                {/* Estadísticas principales */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Servicios Activos</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{servicios.filter((s) => s.activo).length}</div>
                      <p className="text-xs text-muted-foreground">Plataformas disponibles</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Cuentas Activas</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{estadisticas.totalCuentas}</div>
                      <p className="text-xs text-muted-foreground">Cuentas configuradas</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{estadisticas.totalClientes}</div>
                      <p className="text-xs text-muted-foreground">Clientes registrados</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Usuarios Asignados</CardTitle>
                      <Target className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{estadisticas.usuariosOcupados}</div>
                      <p className="text-xs text-muted-foreground">Perfiles vendidos</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Resumen financiero */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        ${estadisticas.ingresosMensuales.toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">{estadisticas.usuariosOcupados} perfiles vendidos</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
                      <DollarSign className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        $
                        {cuentas
                          .filter((c) => c.activa)
                          .reduce((total, cuenta) => total + (cuenta.precio_base || cuenta.precio_mensual), 0)
                          .toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">{estadisticas.totalCuentas} cuentas activas</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Utilidad</CardTitle>
                      <TrendingUp
                        className={`h-4 w-4 ${(estadisticas.ingresosMensuales - cuentas.filter((c) => c.activa).reduce((total, cuenta) => total + (cuenta.precio_base || cuenta.precio_mensual), 0)) >= 0 ? "text-green-600" : "text-red-600"}`}
                      />
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`text-2xl font-bold ${(estadisticas.ingresosMensuales - cuentas.filter((c) => c.activa).reduce((total, cuenta) => total + (cuenta.precio_base || cuenta.precio_mensual), 0)) >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        $
                        {(
                          estadisticas.ingresosMensuales -
                          cuentas
                            .filter((c) => c.activa)
                            .reduce((total, cuenta) => total + (cuenta.precio_base || cuenta.precio_mensual), 0)
                        ).toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground">Ganancia neta mensual</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Acciones rápidas */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Acciones Rápidas</CardTitle>
                      <CardDescription>Accede rápidamente a las funciones más utilizadas</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {/* Agregar Cliente */}
                        <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="w-full justify-start bg-transparent" variant="outline">
                              <Users className="h-4 w-4 mr-2" />
                              Agregar Nuevo Cliente
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Nuevo Cliente</DialogTitle>
                              <DialogDescription>Agrega un nuevo cliente al sistema</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleClienteSubmit} className="space-y-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="nombre" className="text-right">
                                  Nombre*
                                </Label>
                                <Input
                                  id="nombre"
                                  value={clienteForm.nombre}
                                  onChange={(e) => {
                                    const valor = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "").toUpperCase()
                                    setClienteForm({ ...clienteForm, nombre: valor })
                                  }}
                                  className="col-span-3"
                                  placeholder="JORGE PEREZ"
                                  required
                                />
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="telefono" className="text-right">
                                  Telefono*
                                </Label>
                                <Input
                                  id="telefono"
                                  value={clienteForm.telefono}
                                  onChange={(e) => {
                                    let valor = e.target.value.replace(/[^\d+]/g, "")
                                    if (!valor.startsWith("+52")) {
                                      valor = "+52" + valor.replace(/^\+?52?/, "")
                                    }
                                    setClienteForm({ ...clienteForm, telefono: valor })
                                  }}
                                  className="col-span-3"
                                  required
                                />
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="email" className="text-right">
                                  Correo
                                </Label>
                                <Input
                                  id="email"
                                  type="email"
                                  value={clienteForm.email}
                                  onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                                  className="col-span-3"
                                  placeholder="ejemplo@gmail.com"
                                />
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="codigo" className="text-right">
                                  Código*
                                </Label>
                                <div className="col-span-3 space-y-2">
                                  <Input
                                    id="codigo"
                                    value={clienteForm.codigo}
                                    onChange={(e) => {
                                      const valor = e.target.value.replace(/\D/g, "").slice(0, 4)
                                      setClienteForm({ ...clienteForm, codigo: valor })
                                      if (valor.length === 4) {
                                        setCodigoError("")
                                      } else if (valor.length > 0) {
                                        setCodigoError("El código debe tener exactamente 4 dígitos")
                                      } else {
                                        setCodigoError("")
                                      }
                                    }}
                                    className={`col-span-3 ${codigoError ? "border-red-500" : ""}`}
                                    placeholder="1234"
                                    maxLength={4}
                                    required
                                  />
                                  {codigoError && (
                                    <Alert variant="destructive">
                                      <AlertCircle className="h-4 w-4" />
                                      <AlertDescription>{codigoError}</AlertDescription>
                                    </Alert>
                                  )}
                                  <p className="text-xs text-muted-foreground">Debe contener exactamente 4 dígitos</p>
                                </div>
                              </div>

                              <DialogFooter>
                                <Button type="submit" disabled={!!codigoError || clienteForm.codigo.length !== 4}>
                                  Agregar Cliente
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>

                        {/* Crear Cuenta */}
                        <Dialog open={cuentaDialogOpen} onOpenChange={setCuentaDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              className="w-full justify-start bg-transparent"
                              variant="outline"
                              onClick={resetCuentaForm}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Crear Nueva Cuenta
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                              <DialogTitle>Nueva Cuenta</DialogTitle>
                              <DialogDescription>Agrega una nueva cuenta de servicio</DialogDescription>
                            </DialogHeader>

                            <form onSubmit={handleCuentaSubmit} className="space-y-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="servicio" className="text-right">
                                  Servicio
                                </Label>
                                <Select value={cuentaForm.servicio_id} onValueChange={handleServicioChange} required>
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Selecciona un servicio" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {servicios
                                      .filter((s) => s.activo)
                                      .map((servicio) => (
                                        <SelectItem key={servicio.id} value={servicio.id.toString()}>
                                          {servicio.emoji} {servicio.nombre}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="tipo_cuenta" className="text-right">
                                  Tipo
                                </Label>
                                <Select
                                  value={cuentaForm.tipo_cuenta}
                                  onValueChange={(value) => setCuentaForm({ ...cuentaForm, tipo_cuenta: value })}
                                >
                                  <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="privada">Privada (1 perfil)</SelectItem>
                                    <SelectItem value="estandar">Estándar (4 perfiles)</SelectItem>
                                    <SelectItem value="compartida">Compartida (múltiples perfiles)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="numero_cuenta" className="text-right">
                                  Número
                                </Label>
                                <div className="col-span-3 space-y-2">
                                  <Input
                                    id="numero_cuenta"
                                    type="number"
                                    min="1"
                                    value={cuentaForm.numero_cuenta}
                                    onChange={(e) => handleNumeroChange(e.target.value)}
                                    className={numeroError ? "border-red-500" : ""}
                                    placeholder="1"
                                    required
                                  />
                                  {numeroError && (
                                    <Alert variant="destructive">
                                      <AlertCircle className="h-4 w-4" />
                                      <AlertDescription>{numeroError}</AlertDescription>
                                    </Alert>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Se sugiere automáticamente el primer número disponible
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="email" className="text-right">
                                  Email
                                </Label>
                                <Input
                                  id="email"
                                  type="email"
                                  value={cuentaForm.email}
                                  onChange={(e) => setCuentaForm({ ...cuentaForm, email: e.target.value })}
                                  className="col-span-3"
                                  required
                                />
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="password" className="text-right">
                                  Contraseña
                                </Label>
                                <Input
                                  id="password"
                                  type="text"
                                  value={cuentaForm.password}
                                  onChange={(e) => setCuentaForm({ ...cuentaForm, password: e.target.value })}
                                  className="col-span-3"
                                  required
                                />
                              </div>

                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="vencimiento" className="text-right">
                                  Vencimiento
                                </Label>
                                <Input
                                  id="vencimiento"
                                  type="date"
                                  value={cuentaForm.fecha_vencimiento}
                                  onChange={(e) => setCuentaForm({ ...cuentaForm, fecha_vencimiento: e.target.value })}
                                  className="col-span-3"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="precio_base">Costo ($)</Label>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustPrice("precio_base", false)}
                                      className="px-2"
                                    >
                                      -
                                    </Button>
                                    <Input
                                      id="precio_base"
                                      type="number"
                                      step="1"
                                      value={cuentaForm.precio_base}
                                      onChange={(e) => setCuentaForm({ ...cuentaForm, precio_base: e.target.value })}
                                      className="text-center"
                                      required
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustPrice("precio_base", true)}
                                      className="px-2"
                                    >
                                      +
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">Costo de la cuenta (inversión)</p>
                                </div>
                                <div>
                                  <Label htmlFor="precio_cliente">Precio Cliente ($)</Label>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustPrice("precio_cliente", false)}
                                      className="px-2"
                                    >
                                      -
                                    </Button>
                                    <Input
                                      id="precio_cliente"
                                      type="number"
                                      step="1"
                                      value={cuentaForm.precio_cliente}
                                      onChange={(e) => setCuentaForm({ ...cuentaForm, precio_cliente: e.target.value })}
                                      className="text-center"
                                      required
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => adjustPrice("precio_cliente", true)}
                                      className="px-2"
                                    >
                                      +
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">Precio de venta por perfil</p>
                                </div>
                              </div>

                              <DialogFooter>
                                <Button type="submit" disabled={!!numeroError}>
                                  Crear Cuenta
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border rounded-2xl shadow-md">
                    <CardContent>
                      <h2 className="text-lg font-bold mb-4">Servicios más utilizados</h2>

                      <div className="space-y-4 max-h-[150px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        {serviciosMasUtilizados.length > 0 ? (
                          serviciosMasUtilizados.map((servicio) => (
                            <div key={servicio.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{servicio.emoji}</span>
                                <p className="font-medium">{servicio.nombre}</p>
                              </div>
                              <Badge variant={servicio.usuariosAsignados > 0 ? "default" : "secondary"}>
                                {servicio.usuariosAsignados} usuarios
                              </Badge>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-muted-foreground">No hay servicios configurados</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="servicios">
                <ServiciosTab />
              </TabsContent>

              <TabsContent value="cuentas">
                <CuentasTab />
              </TabsContent>

              <TabsContent value="clientes">
                <ClientesTab />
              </TabsContent>

              <TabsContent value="usuarios">
                <UsuariosTab />
              </TabsContent>

              <TabsContent value="financiero">
                <ControlFinanciero />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
