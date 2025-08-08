"use client"
import { useState, useMemo, useEffect } from "react"
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
} from "@/components/ui/dialog"
import { useApp } from "@/contexts/app-context"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Users, UserCheck, UserX, DollarSign, Search, ArrowUpDown, Edit, Trash2, Phone } from 'lucide-react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function UsuariosTab() {
  const {
    servicios,
    cuentas,
    cuentaUsuarios,
    clientes,
    asignaciones,
    refreshUsuarios,
    refreshAsignaciones,
    refreshClientes,
  } = useApp()
  const { toast } = useToast()

  const [busqueda, setBusqueda] = useState("")
  const [filtroServicio, setFiltroServicio] = useState("todos")
  const [filtroGrupo, setFiltroGrupo] = useState("todos")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [ordenAlfabetico, setOrdenAlfabetico] = useState<"asc" | "desc">("asc")
  const [ordenVencimiento, setOrdenVencimiento] = useState<"asc" | "desc" | "none">("none")
  const [asignacionDialogOpen, setAsignacionDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<any>(null)
  const [asignacionEditando, setAsignacionEditando] = useState<any>(null)
  const [clienteBusqueda, setClienteBusqueda] = useState("")
  const [ordenAsignados, setOrdenAsignados] = useState<"asc" | "desc">("asc")

  const [asignacionForm, setAsignacionForm] = useState({
    cliente_id: "",
    fecha_vencimiento: "",
    costo_personalizado: "",
  })

  const resetAsignacionForm = () => {
    // Crear fecha por defecto (un mes después) sin problemas de timezone
    const fechaDefault = new Date()
    fechaDefault.setMonth(fechaDefault.getMonth() + 1)

    // Formatear la fecha como YYYY-MM-DD sin conversión de timezone
    const year = fechaDefault.getFullYear()
    const month = String(fechaDefault.getMonth() + 1).padStart(2, "0")
    const day = String(fechaDefault.getDate()).padStart(2, "0")
    const fechaFormateada = `${year}-${month}-${day}`

    setAsignacionForm({
      cliente_id: "",
      fecha_vencimiento: fechaFormateada,
      costo_personalizado: "",
    })
    setClienteBusqueda("")
  }

  // Obtener usuarios con información completa
  const usuariosCompletos = useMemo(() => {
    if (!cuentaUsuarios || !cuentas || !servicios) return []

    return cuentaUsuarios
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
          fecha_contratacion: asignacion?.fecha_contratacion,
          fecha_vencimiento_usuario: asignacion?.fecha_vencimiento_usuario,
          nombre_perfil: asignacion?.nombre_perfil || `Usuario ${usuario.usuario_numero}`,
          pin_asignado: asignacion?.pin_asignado || usuario.pin,
          costo_suscripcion: asignacion?.costo_suscripcion,
        }
      })
      .filter((usuario) => usuario.cuenta && usuario.servicio && usuario.cuenta.activa)
  }, [cuentaUsuarios, asignaciones, clientes, cuentas, servicios])

  // Debug: agregar después del useMemo de usuariosCompletos
  console.log("Debug - cuentaUsuarios:", cuentaUsuarios?.length || 0)
  console.log("Debug - usuariosCompletos:", usuariosCompletos?.length || 0)

  // Filtrar y ordenar usuarios con verificaciones de undefined
  const usuariosFiltrados = useMemo(() => {
    if (!usuariosCompletos || usuariosCompletos.length === 0) return []

    const filtered = usuariosCompletos.filter((usuario) => {
      // Verificaciones seguras para evitar errores de undefined
      const clienteNombre = usuario.cliente?.nombre || ""
      const clienteTelefono = usuario.cliente?.telefono || ""
      const servicioNombre = usuario.servicio?.nombre || ""
      const cuentaNombre = usuario.cuenta?.nombre || ""
      const nombrePerfil = usuario.nombre_perfil || ""
      
      const matchBusqueda =
        !busqueda ||
        clienteNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        clienteTelefono.includes(busqueda) ||
        servicioNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        cuentaNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        nombrePerfil.toLowerCase().includes(busqueda.toLowerCase())

      const matchServicio = filtroServicio === "todos" || usuario.servicio?.id.toString() === filtroServicio

      const matchGrupo = filtroGrupo === "todos" || usuario.cuenta?.id.toString() === filtroGrupo

      const matchEstado = (() => {
        const hoy = new Date()
        const vencimiento = usuario.fecha_vencimiento_usuario
          ? new Date(usuario.fecha_vencimiento_usuario + "T00:00:00")
          : null

        switch (filtroEstado) {
          case "todos": // ahora solo muestra ocupados
            return usuario.ocupado
          case "activo":
            return usuario.ocupado && (!vencimiento || vencimiento > hoy)
          case "proximo_vencer":
            if (!vencimiento || !usuario.ocupado) return false
            const diffTime = vencimiento.getTime() - hoy.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            return diffDays >= 0 && diffDays <= 7
          case "vencido":
            return usuario.ocupado && vencimiento && vencimiento < hoy
          default:
            return true
        }
      })()

      return matchBusqueda && matchServicio && matchGrupo && matchEstado
    })

    // Add safety check before sorting
    if (!filtered || filtered.length === 0) return []

    filtered.sort((a, b) => {
      // First apply expiration date sorting if active
      if (ordenVencimiento !== "none") {
        const fechaA = a.fecha_vencimiento_usuario ? new Date(a.fecha_vencimiento_usuario + "T00:00:00").getTime() : 0
        const fechaB = b.fecha_vencimiento_usuario ? new Date(b.fecha_vencimiento_usuario + "T00:00:00").getTime() : 0
        
        if (ordenVencimiento === "asc") {
          if (fechaA !== fechaB) return fechaA - fechaB
        } else {
          if (fechaA !== fechaB) return fechaB - fechaA
        }
      }

      if (a.ocupado && !b.ocupado) return -1
      if (!a.ocupado && b.ocupado) return 1

      if (a.ocupado && b.ocupado) {
        const nombreA = a.cliente?.nombre?.toLowerCase() || ""
        const nombreB = b.cliente?.nombre?.toLowerCase() || ""

        if (ordenAlfabetico === "asc") {
          return nombreA.localeCompare(nombreB)
        } else {
          return nombreB.localeCompare(nombreA)
        }
      }

      // For free users, sort by service and user number with alphabetical order
      if (ordenAlfabetico === "asc") {
        const servicioA = a.servicio?.nombre || ""
        const servicioB = b.servicio?.nombre || ""
        const servicioCompare = servicioA.localeCompare(servicioB)
        if (servicioCompare !== 0) return servicioCompare
        return a.usuario_numero - b.usuario_numero
      } else {
        const servicioA = a.servicio?.nombre || ""
        const servicioB = b.servicio?.nombre || ""
        const servicioCompare = servicioB.localeCompare(servicioA)
        if (servicioCompare !== 0) return servicioCompare
        return b.usuario_numero - a.usuario_numero
      }
    })
    return filtered || []
  }, [usuariosCompletos, busqueda, filtroServicio, filtroEstado, ordenAlfabetico, ordenAsignados, filtroGrupo, ordenVencimiento])

  useEffect(() => {
    setFiltroGrupo("todos")
  }, [filtroServicio])

  const clientesFiltrados = useMemo(() => {
    if (!clientes) return []
    
    return clientes
      .filter((c) => c.activo)
      .filter((c) => {
        const nombre = c.nombre || ""
        const telefono = c.telefono || ""
        const busquedaLower = clienteBusqueda.toLowerCase()
        
        return nombre.toLowerCase().includes(busquedaLower) || telefono.includes(clienteBusqueda)
      })
  }, [clientes, clienteBusqueda])

  // Estadísticas
  const estadisticas = useMemo(() => {
    const totalUsuarios = usuariosCompletos.length
    const usuariosOcupados = usuariosCompletos.filter((u) => u.ocupado).length
    const usuariosLibres = totalUsuarios - usuariosOcupados
    const ingresosMensuales = usuariosCompletos
      .filter((u) => u.ocupado && u.asignacion)
      .reduce((total, u) => total + (u.asignacion?.costo_suscripcion || 0), 0)

    return {
      totalUsuarios,
      usuariosOcupados,
      usuariosLibres,
      ingresosMensuales,
    }
  }, [usuariosCompletos])

  const handleAsignarPerfil = (usuario: any) => {
    setPerfilSeleccionado(usuario)
    resetAsignacionForm()
    setAsignacionDialogOpen(true)
  }

  const handleEditarAsignacion = (usuario: any) => {
    setAsignacionEditando(usuario.asignacion)
    setPerfilSeleccionado(usuario)

    // Formatear fecha sin problemas de timezone
    let fechaVencimiento = ""
    if (usuario.asignacion?.fecha_vencimiento_usuario) {
      const fecha = new Date(usuario.asignacion.fecha_vencimiento_usuario + "T00:00:00")
      const year = fecha.getFullYear()
      const month = String(fecha.getMonth() + 1).padStart(2, "0")
      const day = String(fecha.getDate()).padStart(2, "0")
      fechaVencimiento = `${year}-${month}-${day}`
    }

    setAsignacionForm({
      cliente_id: usuario.asignacion.cliente_id.toString(),
      fecha_vencimiento: fechaVencimiento,
      costo_personalizado: usuario.asignacion.costo_suscripcion.toString(),
    })
    setClienteBusqueda(`${usuario.cliente?.nombre || ""} - ${usuario.cliente?.telefono || ""}`)
    setEditDialogOpen(true)
  }

  const handleSubmitAsignacion = async () => {
    if (!perfilSeleccionado || !asignacionForm.cliente_id) return

    try {
      const hoy = new Date()
      const year = hoy.getFullYear()
      const month = String(hoy.getMonth() + 1).padStart(2, "0")
      const day = String(hoy.getDate()).padStart(2, "0")
      const fechaHoy = `${year}-${month}-${day}`

      const costo = asignacionForm.costo_personalizado
        ? Number.parseFloat(asignacionForm.costo_personalizado)
        : perfilSeleccionado.cuenta?.precio_cliente || 0

      const { error } = await supabase.from("usuarios_asignaciones").insert([
        {
          cliente_id: Number.parseInt(asignacionForm.cliente_id),
          cuenta_usuario_id: perfilSeleccionado.id,
          fecha_asignacion: fechaHoy,
          fecha_contratacion: fechaHoy,
          fecha_vencimiento_usuario: asignacionForm.fecha_vencimiento || null,
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
      
      setAsignacionDialogOpen(false)
      setPerfilSeleccionado(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al asignar perfil",
        variant: "destructive",
      })
    }
  }

  const handleUpdateAsignacion = async () => {
    if (!asignacionEditando || !asignacionForm.cliente_id) return

    try {
      const costo = Number.parseFloat(asignacionForm.costo_personalizado) || 0

      const { error } = await supabase
        .from("usuarios_asignaciones")
        .update({
          cliente_id: Number.parseInt(asignacionForm.cliente_id),
          fecha_vencimiento_usuario: asignacionForm.fecha_vencimiento || null,
          costo_suscripcion: costo,
        })
        .eq("id", asignacionEditando.id)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Asignación actualizada correctamente",
      })

      await refreshUsuarios()
      await refreshAsignaciones()
      
      setEditDialogOpen(false)
      setAsignacionEditando(null)
      setPerfilSeleccionado(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar asignación",
        variant: "destructive",
      })
    }
  }

  const handleDesasignarPerfil = async (asignacionId: number) => {
    try {
      const { error } = await supabase.from("usuarios_asignaciones").delete().eq("id", asignacionId)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Perfil desasignado correctamente",
      })

      await refreshUsuarios()
      await refreshAsignaciones()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al desasignar perfil",
        variant: "destructive",
      })
    }
  }

  const getEstadoVencimiento = (fechaVencimiento?: string) => {
    if (!fechaVencimiento) return { estado: "sin_fecha", dias: 0, color: "text-muted-foreground" }

    const hoy = new Date()
    const vencimiento = new Date(fechaVencimiento + "T00:00:00")
    const diffTime = vencimiento.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { estado: "vencido", dias: Math.abs(diffDays), color: "text-red-600" }
    } else if (diffDays <= 3) {
      return { estado: "por_vencer", dias: diffDays, color: "text-orange-600" }
    } else {
      return { estado: "vigente", dias: diffDays, color: "text-green-600" }
    }
  }

  const toggleOrdenAlfabetico = () => {
    setOrdenAlfabetico((prev) => (prev === "asc" ? "desc" : "asc"))
  }

  const toggleOrdenVencimiento = () => {
    setOrdenVencimiento((prev) => {
      if (prev === "none") return "asc"
      if (prev === "asc") return "desc"
      return "none"
    })
  }

  const exportToCSV = () => {
    const headers = [
      "Nombre",
      "Telefono",
      "Correo Cuenta",
      "Contraseña",
      "Servicio",
      "Usuario",
      "Fecha Vencimiento",
      "PIN",
      "Codigo",
      "Precio",
      "Correo Cliente",
    ]

    const csvData = usuariosFiltrados.map((usuario) => {
      return [
        usuario.cliente?.nombre || "Usuario Libre",
        usuario.cliente?.telefono || "",
        usuario.cuenta?.email || "",
        usuario.cuenta?.password || "",
        usuario.servicio?.nombre || "",
        usuario.nombre_perfil || "",
        usuario.fecha_vencimiento_usuario
          ? new Date(usuario.fecha_vencimiento_usuario + "T00:00:00").toLocaleDateString()
          : "",
        usuario.pin_asignado || "",
        usuario.cliente?.codigo || "",
        usuario.ocupado ? `$${usuario.costo_suscripcion?.toFixed(2)}` : "$0.00",
        usuario.cliente?.email || "",
      ]
    })

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `usuarios_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Éxito",
      description: "Lista de usuarios exportada a CSV correctamente",
    })
  }

  const exportToExcel = () => {
    const headers = [
      "Nombre",
      "Telefono",
      "Correo Cuenta",
      "Contraseña",
      "Servicio",
      "Usuario",
      "Fecha Vencimiento",
      "PIN",
      "Codigo",
      "Precio",
      "Correo Cliente",
    ]
    const excelData = usuariosFiltrados.map((usuario) => {
      return {
        Nombre: usuario.cliente?.nombre || "Usuario Libre",
        Telefono: usuario.cliente?.telefono || "",
        "Correo de la cuenta": usuario.cuenta?.email || "",
        Contraseña: usuario.cuenta?.password || "",
        Servicio: usuario.servicio?.nombre || "",
        Usuario: usuario.nombre_perfil || "",
        "Fecha de Vencimiento": usuario.fecha_vencimiento_usuario
          ? new Date(usuario.fecha_vencimiento_usuario + "T00:00:00").toLocaleDateString()
          : "",
        PIN: usuario.pin_asignado || "",
        Codigo: usuario.cliente?.codigo || "",
        Precio: usuario.ocupado ? usuario.costo_suscripcion?.toFixed(2) : "0.00",
        "Correo del cliente": usuario.cliente?.email || "",
      }
    })

    // Create a simple Excel-compatible format
    const worksheet = [headers, ...excelData.map((row) => headers.map((header) => row[header]))]
    const csvContent = worksheet.map((row) => row.map((field) => `"${field}"`).join("\t")).join("\n")

    const blob = new Blob([csvContent], { type: "application/vnd.ms-excel;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `usuarios_${new Date().toISOString().split("T")[0]}.xls`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Éxito",
      description: "Lista de usuarios exportada a Excel correctamente",
    })
  }

  const handleEditUsuario = (usuario: any) => {
    console.log("Edit user", usuario)
  }

  const handleEliminarUsuario = async (usuarioId: number) => {
    console.log("Delete user", usuarioId)
  }

  const getEstadoUsuario = (usuario: any) => {
    if (!usuario.ocupado) return "libre"
    if (!usuario.fecha_vencimiento_usuario) return "activo"

    const hoy = new Date()
    const vencimiento = new Date(usuario.fecha_vencimiento_usuario + "T00:00:00")
    const diffTime = vencimiento.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return "vencido"
    if (diffDays <= 3) return "proximo_vencer"
    return "activo"
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case "activo":
        return "text-green-600 bg-green-100"
      case "libre":
        return "text-blue-600 bg-blue-100"
      case "proximo_vencer":
        return "text-orange-600 bg-orange-100"
      case "vencido":
        return "text-red-600 bg-red-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case "activo":
        return "Vigente"
      case "libre":
        return "Libre"
      case "proximo_vencer":
        return "Por vencer"
      case "vencido":
        return "Vencido"
      default:
        return "Desconocido"
    }
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      
      {/*<div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadisticas.totalUsuarios}</div>
            <p className="text-xs text-muted-foreground">Perfiles configurados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Ocupados</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{estadisticas.usuariosOcupados}</div>
            <p className="text-xs text-muted-foreground">Perfiles asignados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Libres</CardTitle>
            <UserX className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{estadisticas.usuariosLibres}</div>
            <p className="text-xs text-muted-foreground">Perfiles disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${estadisticas.ingresosMensuales.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">De usuarios asignados</p>
          </CardContent>
        </Card>
      </div>
      */}

      {/* Filtros y búsqueda */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Usuarios ({estadisticas.totalUsuarios})</CardTitle>
              <CardDescription>Gestiona los perfiles de usuario de todas las cuentas</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                  <Download className="h-4 w-4" />
                  Descargar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Descargar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel} className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Descargar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o teléfono del cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10"
              />
            </div>

            <Button
              variant="outline"
              onClick={toggleOrdenAlfabetico}
              title="Ordenar por nombre"
              className="flex items-center gap-2 bg-transparent"
            >
              <ArrowUpDown className="h-4 w-4" />
              {ordenAlfabetico === "asc" ? "A-Z" : "Z-A"}
            </Button>

            <Select value={filtroServicio} onValueChange={setFiltroServicio}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por servicio" />
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

            <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por grupo" />
              </SelectTrigger>
              <SelectContent className="max-h-48 overflow-y-auto">
                <SelectItem value="todos">Todos los grupos</SelectItem>
                {cuentas
                  .filter((c) => c.activa && (filtroServicio === "todos" || c.servicio_id?.toString() === filtroServicio))
                  .map((cuenta) => (
                    <SelectItem key={cuenta.id} value={cuenta.id.toString()}>
                      {cuenta.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="proximo_vencer">Próximos a vencer</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                {/*<SelectItem value="libres">Libres</SelectItem>
                <SelectItem value="activo">Activos</SelectItem>*/}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de usuarios */}
          <div className="space-y-4">
            {usuariosFiltrados.length > 0 ? (
              usuariosFiltrados.map((usuario) => {
                const estado = getEstadoUsuario(usuario)
                const diasRestantes = usuario.fecha_vencimiento_usuario
                  ? Math.ceil(
                      (new Date(usuario.fecha_vencimiento_usuario + "T00:00:00").getTime() - new Date().getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null

                return (
                  <Card key={usuario.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 lg:gap-6 xl:gap-20">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">👤</span>
                          <div>
                            <h3 className="font-semibold">{usuario.cliente?.nombre || "Usuario Libre"}</h3>
                            {usuario.cliente?.telefono && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {usuario.cliente.telefono}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="hidden sm:block">
                          <p className="text-sm font-medium">{usuario.servicio?.nombre || ""}</p>
                          <p className="text-xs text-muted-foreground">{usuario.cuenta?.nombre || ""}</p>
                        </div>

                        <div className="hidden md:block">
                          <p className="text-sm font-medium">{usuario.nombre_perfil || ""}</p>
                          {usuario.pin_asignado && (
                            <p className="text-xs text-muted-foreground">PIN: {usuario.pin_asignado}</p>
                          )}
                        </div>

                        <div className="hidden lg:block">
                          <p className="text-sm font-medium">
                            {usuario.ocupado ? `$${usuario.costo_suscripcion?.toFixed(2) || "0.00"}` : "Disponible"}
                          </p>
                          <p className="text-xs text-muted-foreground">{usuario.ocupado ? "Mensual" : "Sin asignar"}</p>
                        </div>

                        {usuario.ocupado && (
                          <>
                            <div className="hidden xl:block">
                              <p className="text-sm font-medium">Contratado</p>
                              <p className="text-xs text-muted-foreground">
                                {usuario.fecha_contratacion
                                  ? new Date(usuario.fecha_contratacion + "T00:00:00").toLocaleDateString()
                                  : "-"}
                              </p>
                            </div>

                            <div className="hidden xl:block">
                              <p className="text-sm font-medium">Vencimiento</p>
                              <p className="text-xs text-muted-foreground">
                                {usuario.fecha_vencimiento_usuario
                                  ? new Date(usuario.fecha_vencimiento_usuario + "T00:00:00").toLocaleDateString()
                                  : "Sin fecha"}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <Badge className={`${getEstadoColor(estado)} text-xs`}>{getEstadoTexto(estado)}</Badge>
                          {usuario.ocupado && usuario.fecha_vencimiento_usuario && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {diasRestantes !== null &&
                                (diasRestantes > 0
                                  ? `${diasRestantes+1} días`
                                  : diasRestantes === 0
                                    ? "Vence hoy"
                                    : `Vencido hace ${Math.abs(diasRestantes)} días`)}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {!usuario.ocupado ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleAsignarPerfil(usuario)}
                              className="h-8 px-3"
                            >
                              Asignar
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditarAsignacion(usuario)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => usuario.asignacion && handleDesasignarPerfil(usuario.asignacion.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            ) : (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-medium mb-2">No se encontraron usuarios</h3>
                <p className="text-muted-foreground">
                  {busqueda || filtroServicio || filtroEstado
                    ? "Intenta ajustar los filtros de búsqueda"
                    : "No hay usuarios asignados aún"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para asignar perfil */}
      <Dialog open={asignacionDialogOpen} onOpenChange={setAsignacionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Asignar Perfil</DialogTitle>
            <DialogDescription>
              Asignar el perfil {perfilSeleccionado?.nombre_usuario || `Usuario ${perfilSeleccionado?.usuario_numero}`}{" "}
              a un cliente
            </DialogDescription>
          </DialogHeader>

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
          </div>

          <DialogFooter>
            <Button onClick={handleSubmitAsignacion} disabled={!asignacionForm.cliente_id}>
              Asignar Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar asignación */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Asignación</DialogTitle>
            <DialogDescription>
              Modificar la asignación del perfil{" "}
              {perfilSeleccionado?.nombre_usuario || `Usuario ${perfilSeleccionado?.usuario_numero}`}
            </DialogDescription>
          </DialogHeader>

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
            </div>

            <div>
              <Label>Costo Mensual ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={asignacionForm.costo_personalizado}
                onChange={(e) => setAsignacionForm({ ...asignacionForm, costo_personalizado: e.target.value })}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleUpdateAsignacion} disabled={!asignacionForm.cliente_id}>
              Actualizar Asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
