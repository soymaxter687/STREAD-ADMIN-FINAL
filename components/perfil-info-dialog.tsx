"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Copy, Check, User, Calendar, DollarSign, Key, Mail, Lock } from "lucide-react"
import type { PerfilCompleto } from "@/lib/supabase"

interface PerfilInfoDialogProps {
  perfil: PerfilCompleto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PerfilInfoDialog({ perfil, open, onOpenChange }: PerfilInfoDialogProps) {
  const { toast } = useToast()
  const [copiedItems, setCopiedItems] = useState<{ [key: string]: boolean }>({})

  if (!perfil) return null

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems((prev) => ({ ...prev, [label]: true }))

      toast({
        title: "Copiado",
        description: `${label} copiado al portapapeles`,
      })

      // Reset copied state after 2 seconds
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

  const copyAllInfo = async () => {
    const infoCompleta = `
🎬 INFORMACIÓN DE ACCESO - ${perfil.servicio_corto}

📧 Correo: ${perfil.cuenta_email}
🔒 Contraseña: ${perfil.cuenta_password}
${perfil.nombre_usuario ? `👤 Usuario: ${perfil.nombre_usuario}` : ""}
${perfil.pin ? `🔑 PIN: ${perfil.pin}` : ""}
${perfil.cuenta_vencimiento ? `📅 Vence: ${formatDate(perfil.cuenta_vencimiento)}` : ""}

¡Disfruta tu servicio! 🍿
    `.trim()

    await copyToClipboard(infoCompleta, "Información completa")
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "No definida"
    // Tratar la fecha como local, no como UTC
    const [year, month, day] = dateString.split("T")[0].split("-")
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))

    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getVencimientoColor = (fecha?: string) => {
    if (!fecha) return "secondary"
    const hoy = new Date()
    const vencimiento = new Date(fecha)
    const diffDays = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return "destructive"
    if (diffDays <= 7) return "destructive"
    if (diffDays <= 30) return "default"
    return "secondary"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{perfil.servicio_emoji}</span>
            Información del Perfil - {perfil.servicio_corto}
          </DialogTitle>
          <DialogDescription>
            Perfil {perfil.perfil_numero} de {perfil.cuenta_nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Estado del perfil */}
          <div className="flex items-center justify-between">
            <Badge variant={perfil.ocupado ? "default" : "secondary"} className="text-sm">
              {perfil.ocupado ? "Ocupado" : "Disponible"}
            </Badge>
            {perfil.ocupado && perfil.cliente_nombre && (
              <div className="text-sm text-muted-foreground">
                Asignado a: <span className="font-medium">{perfil.cliente_nombre}</span>
              </div>
            )}
          </div>

          {/* Información principal para copiar */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                📋 Información para el Cliente
                <Button onClick={copyAllInfo} size="sm" variant="outline">
                  {copiedItems["Información completa"] ? (
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
                  <span className="text-lg">{perfil.servicio_emoji}</span>
                  <div>
                    <div className="font-medium">{perfil.servicio_corto}</div>
                    <div className="text-sm text-muted-foreground">Servicio</div>
                  </div>
                </div>
              </div>

              {/* Correo */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-mono text-sm">{perfil.cuenta_email}</div>
                    <div className="text-sm text-muted-foreground">Correo</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(perfil.cuenta_email, "Correo")}>
                  {copiedItems["Correo"] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {/* Contraseña */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-mono text-sm">{perfil.cuenta_password}</div>
                    <div className="text-sm text-muted-foreground">Contraseña</div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(perfil.cuenta_password, "Contraseña")}>
                  {copiedItems["Contraseña"] ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Usuario (si aplica) */}
              {perfil.nombre_usuario && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{perfil.nombre_usuario}</div>
                      <div className="text-sm text-muted-foreground">Usuario</div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(perfil.nombre_usuario!, "Usuario")}>
                    {copiedItems["Usuario"] ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}

              {/* PIN (si aplica) */}
              {perfil.pin && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-mono text-lg font-bold">{perfil.pin}</div>
                      <div className="text-sm text-muted-foreground">PIN</div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(perfil.pin!, "PIN")}>
                    {copiedItems["PIN"] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              )}

              {/* Fecha de vencimiento */}
              {perfil.cuenta_vencimiento && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Badge variant={getVencimientoColor(perfil.cuenta_vencimiento) as any}>
                        {formatDate(perfil.cuenta_vencimiento)}
                      </Badge>
                      <div className="text-sm text-muted-foreground">Fecha de vencimiento</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(formatDate(perfil.cuenta_vencimiento), "Fecha de vencimiento")}
                  >
                    {copiedItems["Fecha de vencimiento"] ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información del cliente (si está ocupado) */}
          {perfil.ocupado && perfil.cliente_nombre && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">👤 Cliente Asignado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nombre:</span>
                  <span className="font-medium">{perfil.cliente_nombre}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Teléfono:</span>
                  <span className="font-mono">{perfil.cliente_telefono}</span>
                </div>
                {perfil.cliente_email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email:</span>
                    <span className="font-mono text-sm">{perfil.cliente_email}</span>
                  </div>
                )}
                {perfil.fecha_contratacion && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Contratación:</span>
                    <span>{formatDate(perfil.fecha_contratacion)}</span>
                  </div>
                )}
                {perfil.fecha_vencimiento_usuario && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Vence:</span>
                    <Badge variant={getVencimientoColor(perfil.fecha_vencimiento_usuario) as any}>
                      {formatDate(perfil.fecha_vencimiento_usuario)}
                    </Badge>
                  </div>
                )}
                {perfil.costo_suscripcion && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Costo:</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-green-600">{perfil.costo_suscripcion.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
