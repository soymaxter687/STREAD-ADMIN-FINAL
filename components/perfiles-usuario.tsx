"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useApp } from "@/contexts/app-context"
import { supabase, type CuentaUsuario } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { User, UserCheck, UserX, Plus, Calendar, DollarSign, Info } from "lucide-react"

interface PerfilesUsuarioProps {
  cuentaId: number
  usuarios: CuentaUsuario[]
  onUpdate: () => void
}

export function PerfilesUsuario({ cuentaId, usuarios, onUpdate }: PerfilesUsuarioProps) {
  const { clientes, cuentas } = useApp()
  const { toast } = useToast()
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [selectedUsuario, setSelectedUsuario] = useState<CuentaUsuario | null>(null)
  const [selectedCliente, setSelectedCliente] = useState("")
  const [costoPersonalizado, setCostoPersonalizado] = useState("")
  const [fechaVencimiento, setFechaVencimiento] = useState("")

  const cuenta = cuentas.find((c) => c.id === cuentaId)

  // Función para determinar el color del ícono según el estado del perfil
  const getPerfilIconColor = (usuario: CuentaUsuario) => {
    if (!usuario.ocupado) {
      return "text-gray-400" // Blanco/gris para perfiles vacíos
    }

    // Si está ocupado, verificar fecha de vencimiento
    const asignacion = usuario.asignaciones?.[0]
    if (!asignacion?.fecha_vencimiento_usuario) {
      return "text-green-500" // Verde si no tiene fecha de vencimiento
    }

    const hoy = new Date()
    const vencimiento = new Date(asignacion.fecha_vencimiento_usuario)
    const diffTime = vencimiento.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return "text-red-500" // Rojo para vencidos
    } else if (diffDays <= 3) {
      return "text-orange-500" // Naranja para próximos a vencer (3 días o menos)
    } else {
      return "text-green-500" // Verde para activos con más de 3 días
    }
  }

  // Función para obtener el ícono apropiado
  const getPerfilIcon = (usuario: CuentaUsuario) => {
    if (!usuario.ocupado) {
      return <User className={`h-6 w-6 ${getPerfilIconColor(usuario)}`} />
    } else {
      return <UserCheck className={`h-6 w-6 ${getPerfilIconColor(usuario)}`} />
    }
  }

  // Función para obtener información del estado
  const getEstadoInfo = (usuario: CuentaUsuario) => {
    if (!usuario.ocupado) {
      return "Perfil disponible"
    }

    const asignacion = usuario.asignaciones?.[0]
    if (!asignacion?.fecha_vencimiento_usuario) {
      return "Activo sin vencimiento"
    }

    const hoy = new Date()
    const vencimiento = new Date(asignacion.fecha_vencimiento_usuario)
    const diffTime = vencimiento.getTime() - hoy.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return `Vencido hace ${Math.abs(diffDays)} días`
    } else if (diffDays <= 3) {
      return `Vence en ${diffDays} días`
    } else {
      return `Activo (${diffDays} días restantes)`
    }
  }

  const handleAssign = async () => {
    if (!selectedUsuario || !selectedCliente) return

    try {
      const hoy = new Date().toISOString().split("T")[0]
      const vencimiento =
        fechaVencimiento ||
        (() => {
          const fecha = new Date()
          fecha.setMonth(fecha.getMonth() + 1)
          return fecha.toISOString().split("T")[0]
        })()

      const costo = costoPersonalizado
        ? Number.parseFloat(costoPersonalizado)
        : cuenta?.precio_cliente || cuenta?.precio_mensual || 0

      const { error } = await supabase.from("usuarios_asignaciones").insert([
        {
          cliente_id: Number.parseInt(selectedCliente),
          cuenta_usuario_id: selectedUsuario.id,
          fecha_asignacion: hoy,
          fecha_contratacion: hoy,
          fecha_vencimiento_usuario: vencimiento,
          perfil_numero: selectedUsuario.usuario_numero,
          nombre_perfil: selectedUsuario.nombre_usuario || `Usuario ${selectedUsuario.usuario_numero}`,
          pin_asignado: selectedUsuario.pin,
          costo_suscripcion: costo,
          activa: true,
        },
      ])

      if (error) throw error

      toast({
        title: "Éxito",
        description: `Perfil asignado correctamente con costo de $${costo.toFixed(2)}`,
      })

      await onUpdate()
      setAssignDialogOpen(false)
      setSelectedUsuario(null)
      setSelectedCliente("")
      setCostoPersonalizado("")
      setFechaVencimiento("")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al asignar perfil",
        variant: "destructive",
      })
    }
  }

  const handleUnassign = async (usuarioId: number) => {
    if (!confirm("¿Estás seguro de que quieres desasignar este perfil?")) return

    try {
      const { error } = await supabase
        .from("usuarios_asignaciones")
        .delete()
        .eq("cuenta_usuario_id", usuarioId)
        .eq("activa", true)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Perfil desasignado correctamente",
      })

      await onUpdate()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al desasignar perfil",
        variant: "destructive",
      })
    }
  }

  const showPerfilInfo = (usuario: CuentaUsuario) => {
    setSelectedUsuario(usuario)
    setInfoDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Perfiles de Usuario</h4>
        <Badge variant="outline">
          {usuarios.filter((u) => u.ocupado).length}/{usuarios.length} ocupados
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {usuarios.map((usuario) => (
          <Card key={usuario.id} className="relative">
            <CardContent className="p-3">
              <div className="flex flex-col items-center space-y-2">
                <div className="relative">
                  {getPerfilIcon(usuario)}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 rounded-full bg-background border"
                    onClick={() => showPerfilInfo(usuario)}
                  >
                    <Info className="h-3 w-3" />
                  </Button>
                </div>

                <div className="text-center">
                  <p className="text-xs font-medium">{usuario.nombre_usuario || `Usuario ${usuario.usuario_numero}`}</p>
                  {usuario.pin && <p className="text-xs text-muted-foreground font-mono">PIN: {usuario.pin}</p>}
                </div>

                <div className="w-full">
                  {usuario.ocupado ? (
                    <div className="space-y-1">
                      <p className="text-xs text-center text-muted-foreground">
                        {usuario.asignaciones?.[0]?.cliente?.nombre_completo || "Cliente"}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-6 text-xs text-red-600 hover:text-red-700"
                        onClick={() => handleUnassign(usuario.id)}
                      >
                        <UserX className="h-3 w-3 mr-1" />
                        Desasignar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-6 text-xs"
                      onClick={() => {
                        setSelectedUsuario(usuario)
                        setAssignDialogOpen(true)
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Asignar
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog para asignar perfil */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Perfil</DialogTitle>
            <DialogDescription>
              Asigna el perfil "{selectedUsuario?.nombre_usuario || `Usuario ${selectedUsuario?.usuario_numero}`}" a un
              cliente
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes
                    .filter((c) => c.activo)
                    .map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id.toString()}>
                        {cliente.nombre} - {cliente.telefono}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Costo Mensual ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={`Automático: $${(cuenta?.precio_cliente || cuenta?.precio_mensual || 0).toFixed(2)}`}
                value={costoPersonalizado}
                onChange={(e) => setCostoPersonalizado(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Deja vacío para usar el precio automático de la cuenta
              </p>
            </div>

            <div>
              <Label>Fecha de Vencimiento</Label>
              <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Deja vacío para vencimiento automático en 1 mes</p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleAssign} disabled={!selectedCliente}>
              Asignar Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para información del perfil */}
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Información del Perfil</DialogTitle>
            <DialogDescription>
              Detalles del perfil "{selectedUsuario?.nombre_usuario || `Usuario ${selectedUsuario?.usuario_numero}`}"
            </DialogDescription>
          </DialogHeader>

          {selectedUsuario && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getPerfilIcon(selectedUsuario)}
                <div>
                  <p className="font-medium">
                    {selectedUsuario.nombre_usuario || `Usuario ${selectedUsuario.usuario_numero}`}
                  </p>
                  <p className="text-sm text-muted-foreground">{getEstadoInfo(selectedUsuario)}</p>
                </div>
              </div>

              {selectedUsuario.pin && (
                <div>
                  <Label>PIN</Label>
                  <p className="font-mono text-lg">{selectedUsuario.pin}</p>
                </div>
              )}

              {selectedUsuario.ocupado && selectedUsuario.asignaciones?.[0] && (
                <div className="space-y-3 border-t pt-3">
                  <h4 className="font-medium">Información del Cliente</h4>

                  <div>
                    <Label>Cliente</Label>
                    <p>{selectedUsuario.asignaciones[0].cliente?.nombre_completo}</p>
                  </div>

                  <div>
                    <Label>Teléfono</Label>
                    <p>{selectedUsuario.asignaciones[0].cliente?.telefono}</p>
                  </div>

                  {selectedUsuario.asignaciones[0].cliente?.email && (
                    <div>
                      <Label>Email</Label>
                      <p>{selectedUsuario.asignaciones[0].cliente.email}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Fecha de Contratación</Label>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm">
                          {new Date(selectedUsuario.asignaciones[0].fecha_contratacion).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {selectedUsuario.asignaciones[0].fecha_vencimiento_usuario && (
                      <div>
                        <Label>Fecha de Vencimiento</Label>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">
                            {new Date(selectedUsuario.asignaciones[0].fecha_vencimiento_usuario).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <Label>Costo Mensual</Label>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <p className="text-lg font-semibold text-green-600">
                        ${selectedUsuario.asignaciones[0].costo_suscripcion.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
