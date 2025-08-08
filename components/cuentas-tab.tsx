"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useApp } from "@/contexts/app-context"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { formatearNombreCuenta } from "@/lib/utils"
import { Plus, Eye, EyeOff, DollarSign, Users, Trash2, Edit, User, UserCheck, Info, Copy, Check, Search, CalendarIcon, Mail, Lock, Key, AlertCircle, ArrowUp, ArrowDown } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CuentasTab() {
  const {
    servicios,
    cuentas,
    cuentaUsuarios,
    clientes,
    asignaciones,
    refreshCuentas,
    refreshUsuarios,
    refreshAsignaciones,
  } = useApp()
  const { toast } = useToast()

  const [cuentaDialogOpen, setCuentaDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [perfilDialogOpen, setPerfilDialogOpen] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [mostrarPasswords, setMostrarPasswords] = useState<{ [key: number]: boolean }>({})
  const [cuentaEditando, setCuentaEditando] = useState<any>(null)
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<any>(null)
  const [clienteBusqueda, setClienteBusqueda] = useState("")
  const [copiedItems, setCopiedItems] = useState<{ [key: string]: boolean }>({})
  const [numeroError, setNumeroError] = useState("")
  const [ordenVencimiento, setOrdenVencimiento] = useState<'asc' | 'desc'>('asc')

  const [filtroServicio, setFiltroServicio] = useState<string>("todos")
  const [filtroDisponibilidad, setFiltroDisponibilidad] = useState<string>("todas")

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

  const [asignacionForm, setAsignacionForm] = useState({
    cliente_id: "",
    fecha_vencimiento: "",
    costo_personalizado: "",
  })

  // Función para obtener el próximo número disponible
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
  const verificarNumeroExiste = (servicioId: number, numero: string, excludeId?: number) => {
    const servicio = servicios.find((s) => s.id === servicioId)
    if (!servicio) return false

    const nombreFormateado = formatearNombreCuenta(servicio.nombre)
    const nombreCompleto = `${nombreFormateado.toUpperCase()}-${numero}`

    return cuentas.some((c) => c.nombre === nombreCompleto && c.servicio_id === servicioId && c.id !== excludeId)
  }

  // Función para validar número en tiempo real
  const validarNumero = (servicioId: string, numero: string, excludeId?: number) => {
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

    if (verificarNumeroExiste(id, numero, excludeId)) {
      const nombreFormateado = formatearNombreCuenta(servicio.nombre)
      setNumeroError(`La cuenta ${nombreFormateado.toUpperCase()}-${numero} ya existe`)
      return false
    }

    setNumeroError("")
    return true
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

  const resetAsignacionForm = () => {
    const fechaDefault = new Date()
    fechaDefault.setMonth(fechaDefault.getMonth() + 1)

    setAsignacionForm({
      cliente_id: "",
      fecha_vencimiento: fechaDefault.toISOString().split("T")[0],
      costo_personalizado: "",
    })
    setClienteBusqueda("")
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
      const nombreServicio = servicio.nombre.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '')
      const numerosAleatorios = Math.floor(100000 + Math.random() * 900000) // Genera 6 dígitos
      const passwordRecomendada = `${nombreServicio}${numerosAleatorios}`

      setCuentaForm((prev) => ({
        ...prev,
        precio_base: servicio.precio_mensual.toString(),
        precio_cliente: (servicio.precio_mensual * 1.2).toString(),
        email: emailRecomendado,
        password: passwordRecomendada, // Set the recommended password
      }))
    }
  }

  const handleNumeroChange = (numero: string) => {
    setCuentaForm((prev) => ({ ...prev, numero_cuenta: numero }))
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
        const nombreServicio = servicio.nombre.toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '')
        const numerosAleatorios = Math.floor(100000 + Math.random() * 900000)
        const passwordRecomendada = `${nombreServicio}${numerosAleatorios}`
        setCuentaForm((prev) => ({ ...prev, password: passwordRecomendada }))
      }
    }
  }

  const handleNumeroEditChange = (numero: string) => {
    setCuentaForm((prev) => ({ ...prev, numero_cuenta: numero }))
    validarNumero(cuentaForm.servicio_id, numero, cuentaEditando?.id)
    
    // Regenerar email recomendado cuando cambia el número en edición
    if (cuentaForm.servicio_id) {
      const servicio = servicios.find((s) => s.id === Number.parseInt(cuentaForm.servicio_id))
      if (servicio?.formato_correo) {
        const atIndex = servicio.formato_correo.indexOf("@")
        if (atIndex !== -1) {
          const beforeAt = servicio.formato_correo.substring(0, atIndex)
          const afterAt = servicio.formato_correo.substring(atIndex)
          const emailRecomendado = `${beforeAt}${numero}${afterAt}`
          setCuentaForm((prev) => ({ ...prev, email: emailRecomendado }))
        }
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

  const handleCuentaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const servicioId = Number.parseInt(cuentaForm.servicio_id)
      const numero = cuentaForm.numero_cuenta || "1"

      // Validación final antes de enviar
      if (!validarNumero(cuentaForm.servicio_id, numero)) {
        return // El error ya está mostrado
      }

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

      const { data: cuentaCreada, error: errorCuenta } = await supabase
        .from("cuentas")
        .insert([dataToSubmit])
        .select()
        .single()

      if (errorCuenta) throw errorCuenta

      // Check if users already exist for this account (shouldn't happen, but let's be safe)
      const { data: existingUsers, error: checkError } = await supabase
        .from("cuenta_usuarios")
        .select("usuario_numero")
        .eq("cuenta_id", cuentaCreada.id)

      if (checkError) {
        console.error("Error checking existing users:", checkError)
      }

      // Only create users if none exist
      let cantidadUsuarios = 0
      if (!existingUsers || existingUsers.length === 0) {
        // Determinar cantidad de usuarios según el tipo de cuenta
        if (cuentaForm.tipo_cuenta === "privada") {
          // Cuenta privada: siempre 1 perfil, sin importar el servicio
          cantidadUsuarios = 1
          console.log("Creando cuenta PRIVADA con 1 perfil")
        } else {
          // Cuenta compartida: usar la configuración del servicio
          cantidadUsuarios = servicio.usuarios_por_cuenta || 4
          console.log(`Creando cuenta COMPARTIDA con ${cantidadUsuarios} perfiles`)
        }

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

        console.log("Datos de usuarios a crear:", usuariosData)

        const { error: errorUsuarios } = await supabase.from("cuenta_usuarios").insert(usuariosData)

        if (errorUsuarios) {
          console.error("Error creating users:", errorUsuarios)
          // If user creation fails, we should clean up the account
          await supabase.from("cuentas").delete().eq("id", cuentaCreada.id)
          throw new Error(`Error al crear usuarios: ${errorUsuarios.message}`)
        }
      } else {
        console.log("Users already exist for this account:", existingUsers)
        cantidadUsuarios = existingUsers.length
      }

      toast({
        title: "Éxito",
        description: `Cuenta ${cuentaForm.tipo_cuenta} creada correctamente con ${cantidadUsuarios} ${cantidadUsuarios === 1 ? "perfil" : "perfiles"}.`,
      })

      await refreshCuentas()
      await refreshUsuarios()
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

  const handleEditCuenta = (cuenta: any) => {
    setCuentaEditando(cuenta)
    setCuentaForm({
      servicio_id: cuenta.servicio_id.toString(),
      numero_cuenta: cuenta.nombre.split("-")[1] || "1",
      email: cuenta.email,
      password: cuenta.password,
      fecha_vencimiento: cuenta.fecha_vencimiento || "",
      precio_base: cuenta.precio_base?.toString() || cuenta.precio_mensual?.toString() || "",
      precio_cliente: cuenta.precio_cliente?.toString() || "",
      tipo_cuenta: cuenta.tipo_cuenta || "compartida",
      activa: cuenta.activa,
    })
    setNumeroError("")
    setEditDialogOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const servicioId = Number.parseInt(cuentaForm.servicio_id)
      const numero = cuentaForm.numero_cuenta || "1"

      // Validación final antes de enviar
      if (!validarNumero(cuentaForm.servicio_id, numero, cuentaEditando?.id)) {
        return // El error ya está mostrado
      }

      if (verificarNumeroExiste(servicioId, numero, cuentaEditando.id)) {
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
      const nombreFormateado = formatearNombreCuenta(servicio?.nombre || "")
      const nombreCompleto = `${nombreFormateado.toUpperCase()}-${numero}`

      const dataToUpdate = {
        nombre: nombreCompleto,
        email: cuentaForm.email,
        password: cuentaForm.password,
        fecha_vencimiento: cuentaForm.fecha_vencimiento || null,
        precio_base: Number.parseFloat(cuentaForm.precio_base) || 0,
        precio_cliente:
          Number.parseFloat(cuentaForm.precio_cliente) || Number.parseFloat(cuentaForm.precio_base) * 1.2 || 0,
        tipo_cuenta: cuentaForm.tipo_cuenta,
        activa: cuentaForm.activa,
      }

      const { error } = await supabase.from("cuentas").update(dataToUpdate).eq("id", cuentaEditando.id)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Cuenta actualizada correctamente",
      })

      await refreshCuentas()
      setEditDialogOpen(false)
      setCuentaEditando(null)
      resetCuentaForm()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la cuenta",
        variant: "destructive",
      })
    }
  }

  const handleEliminarCuenta = async (cuentaId: number) => {
    try {
      const usuariosCuenta = cuentaUsuarios?.filter((u) => u.cuenta_id === cuentaId && u.ocupado) || []

      if (usuariosCuenta.length > 0) {
        toast({
          title: "Error",
          description: "No se puede eliminar una cuenta con usuarios asignados",
          variant: "destructive",
        })
        return
      }

      const { error: deleteUsersError } = await supabase.from("cuenta_usuarios").delete().eq("cuenta_id", cuentaId)

      if (deleteUsersError) throw deleteUsersError

      const { error } = await supabase.from("cuentas").delete().eq("id", cuentaId)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Cuenta eliminada correctamente",
      })

      await refreshCuentas()
      await refreshUsuarios()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la cuenta",
        variant: "destructive",
      })
    }
  }

  const togglePasswordVisibility = (cuentaId: number) => {
    setMostrarPasswords((prev) => ({
      ...prev,
      [cuentaId]: !prev[cuentaId],
    }))
  }

  const getUsuariosCuenta = (cuentaId: number) => {
    return cuentaUsuarios?.filter((u) => u.cuenta_id === cuentaId) || []
  }

  const getAsignacionPerfil = (usuarioId: number) => {
    return asignaciones?.find((a) => a.cuenta_usuario_id === usuarioId && a.activa)
  }

  // Función para verificar si un perfil es editable
  const isPerfilEditable = (cuenta: any, perfil: any) => {
    // Si es cuenta privada, solo el primer perfil (usuario_numero === 1) es editable
    if (cuenta.tipo_cuenta === "privada") {
      return perfil.usuario_numero === 1
    }
    // Si es cuenta compartida, todos los perfiles son editables
    return true
  }

  const handlePerfilClick = (perfil: any, cuenta: any) => {
    // Verificar si el perfil es editable
    if (!isPerfilEditable(cuenta, perfil)) {
      toast({
        title: "Perfil no disponible",
        description: "En cuentas privadas solo el primer perfil está disponible",
        variant: "destructive",
      })
      return
    }

    setPerfilSeleccionado({ ...perfil, cuenta })

    if (perfil.ocupado) {
      // Perfil ocupado - mostrar info del cliente
      setPerfilDialogOpen(true)
    } else {
      // Perfil libre - mostrar formulario de asignación
      resetAsignacionForm()
      setPerfilDialogOpen(true)
    }
  }

  const handleAsignarPerfil = async () => {
    if (!perfilSeleccionado || !asignacionForm.cliente_id) return

    try {
      const hoy = new Date()
      const fechaHoy = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split("T")[0]
      const costo = asignacionForm.costo_personalizado
        ? Number.parseFloat(asignacionForm.costo_personalizado)
        : perfilSeleccionado.cuenta?.precio_cliente || 0

      const { error } = await supabase.from("usuarios_asignaciones").insert([
        {
          cliente_id: Number.parseInt(asignacionForm.cliente_id),
          cuenta_usuario_id: perfilSeleccionado.id,
          fecha_asignacion: fechaHoy,
          fecha_contratacion: fechaHoy,
          fecha_vencimiento_usuario: asignacionForm.fecha_vencimiento,
          perfil_numero: perfilSeleccionado.usuario_numero,
          nombre_perfil: perfilSeleccionado.nombre_usuario || `Usuario ${perfilSeleccionado.usuario_numero}`,
          pin_asignado: perfilSeleccionado.pin,
          costo_suscripcion: costo,
          activa: true,
        },
      ])

      if (error) throw error

      toast({
        title: "Éxito",
        description: `Perfil asignado correctamente con costo de $${costo.toFixed(2)}`,
      })

      await refreshUsuarios()
      await refreshAsignaciones()
      setPerfilDialogOpen(false)
      setPerfilSeleccionado(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al asignar perfil",
        variant: "destructive",
      })
    }
  }

  const handleDesasignarPerfil = async () => {
    if (!perfilSeleccionado) return

    try {
      const { error } = await supabase
        .from("usuarios_asignaciones")
        .delete()
        .eq("cuenta_usuario_id", perfilSeleccionado.id)
        .eq("activa", true)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Perfil desasignado correctamente",
      })

      await refreshUsuarios()
      await refreshAsignaciones()
      setPerfilDialogOpen(false)
      setPerfilSeleccionado(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al desasignar perfil",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems((prev) => ({ ...prev, [label]: true }))

      toast({
        title: "Copiado",
        description: `${label} copiado al portapapeles`,
      })

      setTimeout(() => {
        setCopiedItems((prev) => ({ ...prev, [label]: false }))
      }, 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      })
    }
  }

  const copyPerfilInfo = async (perfil: any, cuenta: any) => {
    const asignacion = getAsignacionPerfil(perfil.id)
    const infoCompleta = `
🎬 INFORMACIÓN DE ACCESO - ${cuenta.servicio?.nombre}

📧 Correo: ${cuenta.email}
🔒 Contraseña: ${cuenta.password}
👤 Usuario: ${perfil.nombre_usuario || `Usuario ${perfil.usuario_numero}`}
${perfil.pin ? `🔑 PIN: ${perfil.pin}` : ""}
${
  asignacion?.fecha_vencimiento_usuario
    ? `📅 Vence: ${(() => {
        const [year, month, day] = asignacion.fecha_vencimiento_usuario.split("-")
        const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
        return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
      })()}`
    : ""
}

¡Disfruta tu servicio! 🍿
    `.trim()

    await copyToClipboard(infoCompleta, "Información completa del perfil")
  }

  const clientesFiltrados = useMemo(() => {
    return clientes
      .filter((c) => c.activo)
      .filter(
        (c) => c.nombre.toLowerCase().includes(clienteBusqueda.toLowerCase()) || c.telefono.includes(clienteBusqueda),
      )
  }, [clientes, clienteBusqueda])

  const cuentasFiltradas = useMemo(() => {
    let cuentasFiltradas = cuentas

    // Filtrar por servicio
    if (filtroServicio !== "todos") {
      cuentasFiltradas = cuentasFiltradas.filter((cuenta) => cuenta.servicio_id.toString() === filtroServicio)
    }

    // Filtrar por disponibilidad
    if (filtroDisponibilidad === "disponibles") {
      cuentasFiltradas = cuentasFiltradas.filter((cuenta) => {
        const usuariosCuenta = getUsuariosCuenta(cuenta.id)
        const usuariosOcupados = usuariosCuenta.filter((u) => u.ocupado).length

        if (cuenta.tipo_cuenta === "privada") {
          // Para cuentas privadas, verificar si el primer perfil está libre
          const primerPerfil = usuariosCuenta.find((u) => u.usuario_numero === 1)
          return primerPerfil && !primerPerfil.ocupado
        } else {
          // Para cuentas compartidas, verificar si hay perfiles libres
          return usuariosOcupados < usuariosCuenta.length
        }
      })
    }

    // Ordenar por fecha de vencimiento
    cuentasFiltradas = cuentasFiltradas.sort((a, b) => {
      const fechaA = a.fecha_vencimiento ? new Date(a.fecha_vencimiento).getTime() : 0
      const fechaB = b.fecha_vencimiento ? new Date(b.fecha_vencimiento).getTime() : 0
      
      if (ordenVencimiento === 'asc') {
        return fechaA - fechaB
      } else {
        return fechaB - fechaA
      }
    })

    return cuentasFiltradas
  }, [cuentas, filtroServicio, filtroDisponibilidad, cuentaUsuarios, ordenVencimiento])

  const getPerfilIconColor = (perfil: any, cuenta: any) => {
    // Si es cuenta privada y no es el primer perfil, mostrar como deshabilitado
    if (cuenta.tipo_cuenta === "privada" && perfil.usuario_numero !== 1) {
      return "text-gray-200 bg-gray-50 cursor-not-allowed opacity-50"
    }

    if (!perfil.ocupado) {
      return "text-gray-300 hover:text-gray-400 bg-gray-50 hover:bg-gray-100"
    }

    const asignacion = getAsignacionPerfil(perfil.id)
    if (!asignacion?.fecha_vencimiento_usuario) {
      return "text-green-600 bg-green-100 hover:bg-green-200"
    }

    const hoy = new Date()
    const vencimiento = new Date(asignacion.fecha_vencimiento_usuario)
    const diffTime = vencimiento.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return "text-red-600 bg-red-100 hover:bg-red-200"
    } else if (diffDays <= 3) {
      return "text-orange-600 bg-orange-100 hover:bg-orange-200"
    } else {
      return "text-green-600 bg-green-100 hover:bg-green-200"
    }
  }

  const [editandoFecha, setEditandoFecha] = useState(false)
  const [nuevaFechaVencimiento, setNuevaFechaVencimiento] = useState("")

  const handleActualizarFecha = async () => {
    if (!perfilSeleccionado || !nuevaFechaVencimiento) return

    try {
      const { error } = await supabase
        .from("usuarios_asignaciones")
        .update({ fecha_vencimiento_usuario: nuevaFechaVencimiento })
        .eq("cuenta_usuario_id", perfilSeleccionado.id)
        .eq("activa", true)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Fecha de vencimiento actualizada correctamente",
      })

      await refreshUsuarios()
      await refreshAsignaciones()
      setEditandoFecha(false)
      setNuevaFechaVencimiento("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar fecha",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      {/*
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cuentas.length}</div>
            <p className="text-xs text-muted-foreground">Cuentas configuradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cuentas Activas</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{cuentas.filter((c) => c.activa).length}</div>
            <p className="text-xs text-muted-foreground">En funcionamiento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              $
              {cuentas
                .filter((c) => c.activa)
                .reduce((total, cuenta) => total + (cuenta.precio_base || cuenta.precio_mensual), 0)
                .toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Costo mensual total</p>
          </CardContent>
        </Card>
      </div>
      */}

      {/* Botón para crear cuenta */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestión de Cuentas</CardTitle>
              <CardDescription>Administra las cuentas de servicios y sus perfiles</CardDescription>
            </div>
            <Dialog open={cuentaDialogOpen} onOpenChange={setCuentaDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetCuentaForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nueva Cuenta
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
    Correo
  </Label>
  <div className="col-span-3 flex items-center gap-2">
    <Input
      id="email"
      type="email"
      value={cuentaForm.email}
      onChange={(e) => setCuentaForm({ ...cuentaForm, email: e.target.value })}
      required
    />
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => navigator.clipboard.writeText(cuentaForm.email)}
    >
      <Copy className="h-4 w-4" />
    </Button>
  </div>
</div>

<div className="grid grid-cols-4 items-center gap-4">
  <Label htmlFor="password" className="text-right">
    Contraseña
  </Label>
  <div className="col-span-3 flex items-center gap-2">
    <Input
      id="password"
      type="text"
      value={cuentaForm.password}
      onChange={(e) => setCuentaForm({ ...cuentaForm, password: e.target.value })}
      required
    />
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => navigator.clipboard.writeText(cuentaForm.password)}
    >
      <Copy className="h-4 w-4" />
    </Button>
  </div>
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

          {/* Filtros */}
          <div className="flex items-center gap-9 mt-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="filtro-servicio" className="text-sm font-medium">
                Servicio:
              </Label>
              <Select value={filtroServicio} onValueChange={setFiltroServicio}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los servicios</SelectItem>
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

            <div className="flex items-center gap-2">
              <Label htmlFor="filtro-disponibilidad" className="text-sm font-medium">
                Estado:
              </Label>
              <Select value={filtroDisponibilidad} onValueChange={setFiltroDisponibilidad}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las cuentas</SelectItem>
                  <SelectItem value="disponibles">Disponibles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              onClick={() => setOrdenVencimiento(ordenVencimiento === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-2"
            >
              <CalendarIcon className="h-4 w-4" />
              Vencimiento
              {ordenVencimiento === 'asc' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Grid de cuentas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cuentasFiltradas.map((cuenta) => {
          const usuariosCuenta = getUsuariosCuenta(cuenta.id)
          const usuariosOcupados = usuariosCuenta.filter((u) => u.ocupado).length
          const fechaVencimiento = cuenta.fecha_vencimiento ? new Date(cuenta.fecha_vencimiento) : null
          const hoy = new Date()
          const diasRestantes = fechaVencimiento
            ? Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
            : null

          // Para cuentas privadas, mostrar solo el primer perfil
          const perfilesAMostrar =
            cuenta.tipo_cuenta === "privada" ? usuariosCuenta.filter((u) => u.usuario_numero === 1) : usuariosCuenta

          return (
            <Card key={cuenta.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={
                        cuenta.servicio?.imagen_portada ||
                        `/placeholder.svg?height=30&width=30&query=${cuenta.servicio?.nombre || "servicio"}`
                      }
                      alt={cuenta.servicio?.nombre || "Servicio"}
                      className="h-20 w-20 object-contain rounded"
                    />

                    <div>
                      <CardTitle className="text-lg leading-tight">{cuenta.nombre}</CardTitle>
                      <div className="mt-1">
                        <Badge variant={cuenta.tipo_cuenta === "privada" ? "secondary" : "outline"} className="text-xs">
                          {cuenta.tipo_cuenta === "privada" ? "1/1" : `${usuariosOcupados}/${usuariosCuenta.length}`}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">{cuenta.servicio?.nombre}</CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditCuenta(cuenta)} className="h-8 w-8 p-0">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEliminarCuenta(cuenta.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      disabled={usuariosOcupados > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Credenciales */}
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-mono text-xs break-all">{cuenta.email}</p>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Contraseña:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">
                        {mostrarPasswords[cuenta.id] ? cuenta.password : "••••••••"}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePasswordVisibility(cuenta.id)}
                        className="h-6 w-6 p-0"
                      >
                        {mostrarPasswords[cuenta.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Perfiles como íconos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Perfiles</span>
                    <Badge variant="outline" className="text-xs">
                      {cuenta.tipo_cuenta === "privada" ? "1/1" : `${usuariosOcupados}/${usuariosCuenta.length}`}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {perfilesAMostrar.map((perfil) => (
                      <div key={perfil.id} className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePerfilClick(perfil, cuenta)}
                          className={`group h-12 w-full p-2 border-2 relative ${getPerfilIconColor(perfil, cuenta)}`}
                          disabled={!isPerfilEditable(cuenta, perfil)}
                        >
                          {perfil.ocupado ? <UserCheck className="h-6 w-6" /> : <User className="h-6 w-6" />}

                          {/* Tooltip solo visible al pasar el mouse sobre el botón */}
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                            {perfil.nombre_usuario || `Usuario ${perfil.usuario_numero}`}
                            {perfil.ocupado &&
                              (() => {
                                const asignacion = getAsignacionPerfil(perfil.id)
                                const cliente = asignacion ? clientes.find((c) => c.id === asignacion.cliente_id) : null
                                return cliente ? (
                                  <>
                                    <br />
                                    {cliente.nombre}
                                  </>
                                ) : null
                              })()}
                            {!isPerfilEditable(cuenta, perfil) && (
                              <>
                                <br />
                                <span className="text-xs text-gray-300">No disponible</span>
                              </>
                            )}
                          </div>
                        </Button>

                        {/* Botón de info - solo para perfiles editables */}
                        {isPerfilEditable(cuenta, perfil) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPerfilSeleccionado({ ...perfil, cuenta })
                              setInfoDialogOpen(true)
                            }}
                            className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full bg-blue-500 hover:bg-blue-600 text-white opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <Info className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {/* Mostrar perfiles deshabilitados para cuentas privadas */}
                    {cuenta.tipo_cuenta === "privada" && usuariosCuenta.length > 1 && (
                      <>
                        {usuariosCuenta
                          .filter((u) => u.usuario_numero !== 1)
                          .slice(0, 3)
                          .map((perfil) => (
                            <div key={`disabled-${perfil.id}`} className="relative group">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-12 w-full p-2 border-2 text-gray-200 bg-gray-50 cursor-not-allowed opacity-50"
                                disabled
                              >
                                <User className="h-6 w-6" />
                              </Button>
                              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                No disponible en cuenta privada
                              </div>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Información adicional */}
                <div className="space-y-2 pt-2 border-t">
                  {(() => {
                    if (!cuenta.fecha_vencimiento) return null
                    const fechaVencimiento = new Date(cuenta.fecha_vencimiento)
                    const hoy = new Date()
                    const diasRestantes = Math.ceil(
                      (fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
                    )

                    return (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Vencimiento:</span>
                        <div className="text-right">
                          <div>
                            {(() => {
                              const [year, month, day] = cuenta.fecha_vencimiento.split("-")
                              const date = new Date(
                                Number.parseInt(year),
                                Number.parseInt(month) - 1,
                                Number.parseInt(day),
                              )
                              return date.toLocaleDateString("es-ES", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            })()}
                          </div>
                          <div
                            className={`text-xs ${
                              diasRestantes && diasRestantes < 7
                                ? "text-red-600"
                                : diasRestantes && diasRestantes < 30
                                  ? "text-yellow-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {diasRestantes !== null &&
                              (diasRestantes > 0
                                ? `${diasRestantes} días`
                                : diasRestantes === 0
                                  ? "Vence hoy"
                                  : "Vencida")}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

{/* 
<div className="flex items-center justify-between text-sm">
  <span className="text-muted-foreground">Precios:</span>
  <div className="text-right">
    <div className="text-red-600">-${(cuenta.precio_base || cuenta.precio_mensual).toFixed(2)}</div>
    <div className="text-green-600">+${(cuenta.precio_cliente || 0).toFixed(2)}</div>
  </div>
</div> 
*/}



                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Mensaje cuando no hay cuentas */}
      {cuentasFiltradas.length === 0 && cuentas.length > 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">No hay cuentas que coincidan con los filtros</h3>
            <p className="text-muted-foreground mb-6">Ajusta los filtros para ver más cuentas</p>
            <Button
              onClick={() => {
                setFiltroServicio("todos")
                setFiltroDisponibilidad("todas")
              }}
            >
              Limpiar Filtros
            </Button>
          </CardContent>
        </Card>
      )}

      {cuentas.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">No hay cuentas configuradas</h3>
            <p className="text-muted-foreground mb-6">Crea tu primera cuenta para comenzar a gestionar servicios</p>
            <Button onClick={() => setCuentaDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Cuenta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog de edición */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Cuenta</DialogTitle>
            <DialogDescription>Modifica los datos de la cuenta</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_tipo_cuenta" className="text-right">
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
                  <SelectItem value="compartida">Compartida (múltiples perfiles)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_numero_cuenta" className="text-right">
                Número
              </Label>
              <div className="col-span-3 space-y-2">
                <Input
                  id="edit_numero_cuenta"
                  type="number"
                  min="1"
                  value={cuentaForm.numero_cuenta}
                  onChange={(e) => handleNumeroEditChange(e.target.value)}
                  className={numeroError ? "border-red-500" : ""}
                  required
                />
                {numeroError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{numeroError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_email" className="text-right">
                Email
              </Label>
              <Input
                id="edit_email"
                type="email"
                value={cuentaForm.email}
                onChange={(e) => setCuentaForm({ ...cuentaForm, email: e.target.value })}
                className="col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_password" className="text-right">
                Contraseña
              </Label>
              <Input
                id="edit_password"
                type="text"
                value={cuentaForm.password}
                onChange={(e) => setCuentaForm({ ...cuentaForm, password: e.target.value })}
                className="col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit_vencimiento" className="text-right">
                Vencimiento
              </Label>
              <Input
                id="edit_vencimiento"
                type="date"
                value={cuentaForm.fecha_vencimiento}
                onChange={(e) => setCuentaForm({ ...cuentaForm, fecha_vencimiento: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_precio_base">Costo ($)</Label>
                <Input
                  id="edit_precio_base"
                  type="number"
                  step="1"
                  value={cuentaForm.precio_base}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, precio_base: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_precio_cliente">Precio Cliente ($)</Label>
                <Input
                  id="edit_precio_cliente"
                  type="number"
                  step="1"
                  value={cuentaForm.precio_cliente}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, precio_cliente: e.target.value })}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={!!numeroError}>
                Actualizar Cuenta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para perfiles */}
      <Dialog open={perfilDialogOpen} onOpenChange={(open) => {
        setPerfilDialogOpen(open)
        if (!open) {
          // Cancelar edición de fecha al cerrar el dialog
          setEditandoFecha(false)
          setNuevaFechaVencimiento("")
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{perfilSeleccionado?.ocupado ? "Perfil Ocupado" : "Asignar Perfil"}</DialogTitle>
            <DialogDescription>
              {perfilSeleccionado?.ocupado
                ? `Información del perfil ${perfilSeleccionado?.nombre_usuario || `Usuario ${perfilSeleccionado?.usuario_numero}`}`
                : `Asignar el perfil ${perfilSeleccionado?.nombre_usuario || `Usuario ${perfilSeleccionado?.usuario_numero}`} a un cliente`}
            </DialogDescription>
          </DialogHeader>

          {perfilSeleccionado?.ocupado ? (
            // Perfil ocupado - mostrar info del cliente
            <div className="space-y-4">
              {(() => {
                const asignacion = getAsignacionPerfil(perfilSeleccionado.id)
                const cliente = asignacion ? clientes.find((c) => c.id === asignacion.cliente_id) : null

                if (!cliente || !asignacion) return null

                return (
                  <>
                    <div>
                      <Label>Cliente</Label>
                      <p className="font-medium">{cliente.nombre}</p>
                    </div>

                    <div>
                      <Label>Teléfono</Label>
                      <p className="font-mono">{cliente.telefono}</p>
                    </div>

                    {cliente.email && (
                      <div>
                        <Label>Email</Label>
                        <p className="font-mono text-sm">{cliente.email}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Fecha de Contratación</Label>
                        <p className="text-sm">
                          {(() => {
                            const [year, month, day] = asignacion.fecha_contratacion.split("-")
                            const date = new Date(
                              Number.parseInt(year),
                              Number.parseInt(month) - 1,
                              Number.parseInt(day),
                            )
                            return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
                          })()}
                        </p>
                      </div>

                      {asignacion.fecha_vencimiento_usuario && (
                        <div>
                          <Label>Fecha de Vencimiento</Label>
                          {editandoFecha ? (
                            <div className="space-y-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {nuevaFechaVencimiento ? (
                                      format(new Date(nuevaFechaVencimiento + 'T00:00:00'), "PPP", { locale: es })
                                    ) : (
                                      <span>Seleccionar fecha</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 max-h-80" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={nuevaFechaVencimiento ? new Date(nuevaFechaVencimiento + 'T00:00:00') : undefined}
                                    onSelect={(date) => {
                                      if (date) {
                                        const year = date.getFullYear()
                                        const month = String(date.getMonth() + 1).padStart(2, '0')
                                        const day = String(date.getDate()).padStart(2, '0')
                                        setNuevaFechaVencimiento(`${year}-${month}-${day}`)
                                      }
                                    }}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                    className="max-h-72"
                                  />
                                </PopoverContent>
                              </Popover>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setEditandoFecha(false)
                                  setNuevaFechaVencimiento("")
                                }}
                                variant="outline"
                                className="w-full"
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-sm">
                                {(() => {
                                  const [year, month, day] = asignacion.fecha_vencimiento_usuario.split("-")
                                  const date = new Date(
                                    Number.parseInt(year),
                                    Number.parseInt(month) - 1,
                                    Number.parseInt(day),
                                  )
                                  return date.toLocaleDateString("es-ES", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })
                                })()}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditandoFecha(true)
                                  setNuevaFechaVencimiento(asignacion.fecha_vencimiento_usuario)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Costo Mensual</Label>
                      <p className="text-lg font-semibold text-green-600">${asignacion.costo_suscripcion.toFixed(2)}</p>
                    </div>
                  </>
                )
              })()}

              <DialogFooter>
                {editandoFecha && (
                  <Button onClick={handleActualizarFecha} disabled={!nuevaFechaVencimiento}>
                    Actualizar
                  </Button>
                )}
                <Button variant="destructive" onClick={handleDesasignarPerfil}>
                  Desasignar Perfil
                </Button>
              </DialogFooter>
            </div>
          ) : (
            // Perfil libre - formulario de asignación
            <div className="space-y-4">
              <div>
                <Label>Cliente</Label>
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      placeholder="Buscar cliente por nombre o teléfono..."
                      value={clienteBusqueda}
                      onChange={(e) => setClienteBusqueda(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Cliente seleccionado */}
                  {asignacionForm.cliente_id && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-green-800">
                            {clientes.find((c) => c.id.toString() === asignacionForm.cliente_id)?.nombre}
                          </div>
                          <div className="text-sm text-green-600">
                            {clientes.find((c) => c.id.toString() === asignacionForm.cliente_id)?.telefono}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAsignacionForm({ ...asignacionForm, cliente_id: "" })
                            setClienteBusqueda("")
                          }}
                          className="text-green-600 hover:text-green-700"
                        >
                          Cambiar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Resultados de búsqueda */}
                  {clienteBusqueda && !asignacionForm.cliente_id && (
                    <div className="max-h-48 overflow-y-auto border rounded-md bg-background shadow-lg">
                      {clientesFiltrados.length > 0 ? (
                        clientesFiltrados.map((cliente) => (
                          <div
                            key={cliente.id}
                            onClick={() => {
                              setAsignacionForm({ ...asignacionForm, cliente_id: cliente.id.toString() })
                              setClienteBusqueda("")
                            }}
                            className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                          >
                            <div className="font-medium">{cliente.nombre}</div>
                            <div className="text-sm text-muted-foreground">{cliente.telefono}</div>
                            {cliente.email && <div className="text-xs text-muted-foreground">{cliente.email}</div>}
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-muted-foreground">No se encontraron clientes</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Fecha de Vencimiento</Label>
                <Input
                  type="date"
                  value={asignacionForm.fecha_vencimiento}
                  onChange={(e) => setAsignacionForm({ ...asignacionForm, fecha_vencimiento: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">Por defecto se establece un mes después de hoy</p>
              </div>

              <div>
                <Label>Costo Personalizado ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={`Automático: $${(perfilSeleccionado?.cuenta?.precio_cliente || 0).toFixed(2)}`}
                  value={asignacionForm.costo_personalizado}
                  onChange={(e) => setAsignacionForm({ ...asignacionForm, costo_personalizado: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Deja vacío para usar el precio automático de la cuenta
                </p>
              </div>

              <DialogFooter>
                <Button onClick={handleAsignarPerfil} disabled={!asignacionForm.cliente_id}>
                  Asignar Perfil
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de información del perfil */}
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{perfilSeleccionado?.cuenta?.servicio?.emoji}</span>
              Información del Perfil - {perfilSeleccionado?.cuenta?.servicio?.nombre}
            </DialogTitle>
            <DialogDescription>
              Perfil {perfilSeleccionado?.usuario_numero} de {perfilSeleccionado?.cuenta?.nombre}
            </DialogDescription>
          </DialogHeader>

          {perfilSeleccionado && (
            <div className="space-y-4">
              {/* Información principal para copiar */}
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    📋 Información para el Cliente
                    <Button
                      onClick={() => copyPerfilInfo(perfilSeleccionado, perfilSeleccionado.cuenta)}
                      size="sm"
                      variant="outline"
                    >
                      {copiedItems["Información completa del perfil"] ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      Copiar Todo
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Servicio */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{perfilSeleccionado.cuenta?.servicio?.emoji}</span>
                      <div>
                        <div className="font-medium">{perfilSeleccionado.cuenta?.servicio?.nombre}</div>
                        <div className="text-sm text-muted-foreground">Servicio</div>
                      </div>
                    </div>
                  </div>

                  {/* Correo */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-mono text-sm">{perfilSeleccionado.cuenta?.email}</div>
                        <div className="text-sm text-muted-foreground">Correo</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(perfilSeleccionado.cuenta?.email, "Correo")}
                    >
                      {copiedItems["Correo"] ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Contraseña */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-mono text-sm">{perfilSeleccionado.cuenta?.password}</div>
                        <div className="text-sm text-muted-foreground">Contraseña</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(perfilSeleccionado.cuenta?.password, "Contraseña")}
                    >
                      {copiedItems["Contraseña"] ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Usuario */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {perfilSeleccionado.nombre_usuario || `Usuario ${perfilSeleccionado.usuario_numero}`}
                        </div>
                        <div className="text-sm text-muted-foreground">Usuario</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        copyToClipboard(
                          perfilSeleccionado.nombre_usuario || `Usuario ${perfilSeleccionado.usuario_numero}`,
                          "Usuario",
                        )
                      }
                    >
                      {copiedItems["Usuario"] ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* PIN (si aplica) */}
                  {perfilSeleccionado.pin && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-mono text-lg font-bold">{perfilSeleccionado.pin}</div>
                          <div className="text-sm text-muted-foreground">PIN</div>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(perfilSeleccionado.pin, "PIN")}>
                        {copiedItems["PIN"] ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Fecha de vencimiento del usuario */}
                  {(() => {
                    const asignacion = getAsignacionPerfil(perfilSeleccionado.id)
                    return asignacion?.fecha_vencimiento_usuario ? (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {(() => {
                                const [year, month, day] = asignacion.fecha_vencimiento_usuario.split("-")
                                const date = new Date(
                                  Number.parseInt(year),
                                  Number.parseInt(month) - 1,
                                  Number.parseInt(day),
                                )
                                return date.toLocaleDateString("es-ES", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                              })()}
                            </div>
                            <div className="text-sm text-muted-foreground">Fecha de vencimiento</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const [year, month, day] = asignacion.fecha_vencimiento_usuario.split("-")
                            const date = new Date(
                              Number.parseInt(year),
                              Number.parseInt(month) - 1,
                              Number.parseInt(day),
                            )
                            const formattedDate = date.toLocaleDateString("es-ES", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                            copyToClipboard(formattedDate, "Fecha de vencimiento")
                          }}
                        >
                          {copiedItems["Fecha de vencimiento"] ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    ) : null
                  })()}
                </CardContent>
              </Card>

              {/* Información del cliente (si está ocupado) */}
              {perfilSeleccionado.ocupado &&
                (() => {
                  const asignacion = getAsignacionPerfil(perfilSeleccionado.id)
                  const cliente = asignacion ? clientes.find((c) => c.id === asignacion.cliente_id) : null

                  return asignacion && cliente ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">👤 Cliente Asignado</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Nombre:</span>
                          <span className="font-medium">{cliente.nombre}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Teléfono:</span>
                          <span className="font-mono">{cliente.telefono}</span>
                        </div>
                        {cliente.email && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Email:</span>
                            <span className="font-mono text-sm">{cliente.email}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Contratación:</span>
                          <span>
                            {(() => {
                              const [year, month, day] = asignacion.fecha_contratacion.split("-")
                              const date = new Date(
                                Number.parseInt(year),
                                Number.parseInt(month) - 1,
                                Number.parseInt(day),
                              )
                              return date.toLocaleDateString("es-ES", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            })()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Costo:</span>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="font-semibold text-green-600">
                              ${asignacion.costo_suscripcion.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null
                })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
