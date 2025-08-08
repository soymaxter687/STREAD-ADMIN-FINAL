"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
import { supabase, type Servicio, type ServicioPin } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, Settings, Save } from 'lucide-react'

export function ServiciosTab() {
  const { servicios, refreshServicios, refreshCuentas } = useApp()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingServicio, setEditingServicio] = useState<Servicio | null>(null)
  const [pinesDialogOpen, setPinesDialogOpen] = useState(false)
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null)
  const [serviciosPines, setServiciosPines] = useState<ServicioPin[]>([])
  const [formData, setFormData] = useState({
    nombre: "",
    imagen_portada: "",
    usuarios_por_cuenta: 1,
    pin_requerido: false,
    activo: true,
    formato_correo: "",
  })

  const resetForm = () => {
    setFormData({
      nombre: "",
      imagen_portada: "",
      usuarios_por_cuenta: 1,
      pin_requerido: false,
      activo: true,
      formato_correo: "",
    })
    setEditingServicio(null)
  }

  const loadServicioPines = async (servicioId: number) => {
    try {
      const { data, error } = await supabase
        .from("servicio_pines")
        .select("*")
        .eq("servicio_id", servicioId)
        .order("usuario_numero")

      if (error) throw error
      setServiciosPines(data || [])
    } catch (error: any) {
      console.error("Error loading servicio pines:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los PINs del servicio",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const servicioData = {
        nombre: formData.nombre,
        imagen_portada: formData.imagen_portada,
        usuarios_por_cuenta: formData.usuarios_por_cuenta,
        pin_requerido: formData.pin_requerido,
        activo: formData.activo,
        formato_correo: formData.formato_correo,
        descripcion: "",
        precio_mensual: 0,
        emoji: "📺",
      }

      if (editingServicio) {
        const { error } = await supabase.from("servicios").update(servicioData).eq("id", editingServicio.id)

        if (error) throw error

        // Si se actualizó el formato de correo, actualizar las cuentas existentes
        if (servicioData.formato_correo && servicioData.formato_correo !== editingServicio.formato_correo) {
          try {
            // Obtener todas las cuentas de este servicio
            const { data: cuentasServicio, error: errorCuentas } = await supabase
              .from("cuentas")
              .select("*")
              .eq("servicio_id", editingServicio.id)

            if (errorCuentas) {
              console.error("Error obteniendo cuentas:", errorCuentas)
            } else if (cuentasServicio && cuentasServicio.length > 0) {
              // Actualizar el email de cada cuenta según el nuevo formato
              const actualizaciones = cuentasServicio.map(cuenta => {
                // Extraer el número de la cuenta del nombre (formato: SERVICIO-NUMERO)
                const numeroCuenta = cuenta.nombre.split("-")[1] || "1"
                
                // Generar nuevo email con el formato actualizado
                let nuevoEmail = ""
                if (servicioData.formato_correo) {
                  const atIndex = servicioData.formato_correo.indexOf("@")
                  if (atIndex !== -1) {
                    const beforeAt = servicioData.formato_correo.substring(0, atIndex)
                    const afterAt = servicioData.formato_correo.substring(atIndex)
                    nuevoEmail = `${beforeAt}${numeroCuenta}${afterAt}`
                  }
                }

                return supabase
                  .from("cuentas")
                  .update({ email: nuevoEmail })
                  .eq("id", cuenta.id)
              })

              // Ejecutar todas las actualizaciones
              await Promise.all(actualizaciones)

              toast({
                title: "Formato actualizado",
                description: `Se actualizaron ${cuentasServicio.length} cuentas con el nuevo formato de correo`,
              })
            }
          } catch (error) {
            console.error("Error actualizando cuentas:", error)
            toast({
              title: "Advertencia",
              description: "El servicio se actualizó pero hubo un error al actualizar las cuentas existentes",
              variant: "destructive",
            })
          }
        }

        toast({
          title: "Éxito",
          description: "Servicio actualizado correctamente",
        })
      } else {
        const { error } = await supabase.from("servicios").insert([servicioData])

        if (error) throw error

        toast({
          title: "Éxito",
          description: "Servicio creado correctamente",
        })
      }

      await refreshServicios()
      await refreshCuentas()
      setDialogOpen(false)
      resetForm()
    } catch (error: any) {
      console.error("Error saving service:", error)
      toast({
        title: "Error",
        description: error.message || "Error al guardar el servicio",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (servicio: Servicio) => {
    setEditingServicio(servicio)
    setFormData({
      nombre: servicio.nombre,
      imagen_portada: servicio.imagen_portada || "",
      usuarios_por_cuenta: servicio.usuarios_por_cuenta,
      pin_requerido: servicio.pin_requerido,
      activo: servicio.activo,
      formato_correo: (servicio as any).formato_correo || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este servicio?")) return

    try {
      const { error } = await supabase.from("servicios").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Servicio eliminado correctamente",
      })

      await refreshServicios()
      await refreshCuentas()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el servicio",
        variant: "destructive",
      })
    }
  }

  const handleConfigurarPines = async (servicio: Servicio) => {
    setSelectedServicio(servicio)
    await loadServicioPines(servicio.id)
    setPinesDialogOpen(true)
  }

  const generarConfiguracionPines = (cantidadUsuarios: number) => {
    const pinesExistentes = serviciosPines.reduce(
      (acc, pin) => {
        acc[pin.usuario_numero] = pin
        return acc
      },
      {} as { [key: number]: ServicioPin },
    )

    const nuevaConfiguracion: Partial<ServicioPin>[] = []

    for (let i = 1; i <= cantidadUsuarios; i++) {
      nuevaConfiguracion.push({
        servicio_id: selectedServicio?.id,
        usuario_numero: i,
        pin: pinesExistentes[i]?.pin || "",
        nombre_usuario: pinesExistentes[i]?.nombre_usuario || `Usuario ${i}`,
      })
    }

    return nuevaConfiguracion
  }

  const handleGuardarPines = async () => {
    if (!selectedServicio) return

    try {
      // Generate configuration with current state (including custom names)
      const configuracion = generarConfiguracionPines(selectedServicio.usuarios_por_cuenta)

      // Delete existing configuration
      await supabase.from("servicio_pines").delete().eq("servicio_id", selectedServicio.id)

      // Insert new configuration with custom names and PINs
      const { error } = await supabase.from("servicio_pines").insert(configuracion)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Configuración de PINs y nombres de perfiles guardada correctamente",
      })

      setPinesDialogOpen(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al guardar configuración de PINs",
        variant: "destructive",
      })
    }
  }

  const updatePinConfig = (usuarioNumero: number, pin?: string, nombreUsuario?: string) => {
    if (pin !== undefined) {
      const pinLimpio = pin.replace(/\D/g, "").slice(0, 6)
      
      setServiciosPines((prev) => {
        const updated = [...prev]
        const index = updated.findIndex((p) => p.usuario_numero === usuarioNumero)

        if (index >= 0) {
          updated[index] = { ...updated[index], pin: pinLimpio }
        } else {
          updated.push({
            id: 0,
            servicio_id: selectedServicio?.id || 0,
            usuario_numero: usuarioNumero,
            pin: pinLimpio,
            nombre_usuario: `Usuario ${usuarioNumero}`,
            created_at: "",
            updated_at: "",
          })
        }

        return updated
      })
    }

    if (nombreUsuario !== undefined) {
      setServiciosPines((prev) => {
        const updated = [...prev]
        const index = updated.findIndex((p) => p.usuario_numero === usuarioNumero)

        if (index >= 0) {
          updated[index] = { ...updated[index], nombre_usuario: nombreUsuario }
        } else {
          updated.push({
            id: 0,
            servicio_id: selectedServicio?.id || 0,
            usuario_numero: usuarioNumero,
            pin: "",
            nombre_usuario: nombreUsuario,
            created_at: "",
            updated_at: "",
          })
        }

        return updated
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Servicios Digitales</h2>
          <p className="text-muted-foreground">Gestiona los servicios de streaming y configura perfiles con PINs</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Servicio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingServicio ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
              <DialogDescription>
                {editingServicio ? "Modifica los datos del servicio" : "Agrega un nuevo servicio digital"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="nombre" className="text-right">
                  Nombre *
                </Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="col-span-3"
                  required
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="imagen_portada" className="text-right">
                  Imagen Portada
                </Label>
                <Input
                  id="imagen_portada"
                  value={formData.imagen_portada}
                  onChange={(e) => setFormData({ ...formData, imagen_portada: e.target.value })}
                  className="col-span-3"
                  placeholder="URL de la imagen"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="formato_correo" className="text-right">
                  Formato Correo
                </Label>
                <Input
                  id="formato_correo"
                  value={formData.formato_correo}
                  onChange={(e) => setFormData({ ...formData, formato_correo: e.target.value })}
                  className="col-span-3"
                  placeholder="ejemplo+servicio@gmail.com"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="usuarios" className="text-right">
                  Cantidad Perfiles
                </Label>
                <Input
                  id="usuarios"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.usuarios_por_cuenta}
                  onChange={(e) =>
                    setFormData({ ...formData, usuarios_por_cuenta: Number.parseInt(e.target.value) || 1 })
                  }
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="pin" className="text-right">
                  PIN Requerido
                </Label>
                <Switch
                  id="pin"
                  checked={formData.pin_requerido}
                  onCheckedChange={(checked) => setFormData({ ...formData, pin_requerido: checked })}
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="activo" className="text-right">
                  Activo
                </Label>
                <Switch
                  id="activo"
                  checked={formData.activo}
                  onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                />
              </div>

              <DialogFooter>
                <Button type="submit">{editingServicio ? "Actualizar" : "Crear"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={pinesDialogOpen} onOpenChange={setPinesDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📺 Configurar PINs - {selectedServicio?.nombre}
            </DialogTitle>
            <DialogDescription>
              Define los PINs para cada perfil. Esta configuración se aplicará a todas las cuentas nuevas de este
              servicio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedServicio &&
              Array.from({ length: selectedServicio.usuarios_por_cuenta }, (_, i) => {
                const usuarioNumero = i + 1
                const pinConfig = serviciosPines.find((p) => p.usuario_numero === usuarioNumero)

                return (
                  <Card key={usuarioNumero} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">Perfil {usuarioNumero}</Badge>
                    </div>

<div className="flex items-end gap-2">
  <div className="flex-1">
    <Label className="text-sm">PIN</Label>
    <Input
      value={pinConfig?.pin || ""}
      onChange={(e) => updatePinConfig(usuarioNumero, e.target.value, undefined)}
      placeholder="123456"
      maxLength={6}
      pattern="[0-9]*"
      inputMode="numeric"
      readOnly // evita que se modifique si solo quieres copiar
    />
  </div>
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      if (pinConfig?.pin) {
        navigator.clipboard.writeText(pinConfig.pin);
      }
    }}
  >
    Copiar
  </Button>
</div>
                  </Card>
                )
              })}

            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h4 className="font-medium mb-2">📋 Importante:</h4>
              <ul className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
                <li>• Los nombres de perfiles son editables y personalizables</li>
                <li>• Los PINs solo pueden contener números (máximo 6 dígitos)</li>
                <li>• Esta configuración se aplicará a todas las cuentas nuevas</li>
                <li>• Los perfiles ya ocupados en cuentas existentes no se modificarán</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPinesDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarPines}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Configuración
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {servicios.map((servicio) => (
          <Card key={servicio.id} className={!servicio.activo ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {servicio.imagen_portada ? (
                    <img
                      src={servicio.imagen_portada || "/placeholder.svg"}
                      alt={servicio.nombre}
                      className="w-25 aspect-square rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-25 aspect-square rounded-xl bg-muted flex items-center justify-center text-3xl">
                      📺
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{servicio.nombre}</CardTitle>
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleConfigurarPines(servicio)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(servicio)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(servicio.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{servicio.usuarios_por_cuenta} perfiles</Badge>
                  {servicio.pin_requerido && <Badge variant="outline">PIN requerido</Badge>}
                  <Badge variant={servicio.activo ? "default" : "destructive"}>
                    {servicio.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {servicios.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay servicios</h3>
            <p className="text-muted-foreground text-center mb-4">Comienza agregando tu primer servicio digital</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Servicio
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
