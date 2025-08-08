"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApp } from "@/contexts/app-context"
import { supabase, type Cliente } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, Search, Users } from 'lucide-react'
import * as XLSX from 'xlsx'

export function ClientesTab() {
  const { clientes, refreshClientes } = useApp()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClientes, setSelectedClientes] = useState<number[]>([])
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: "",
    telefono: "+52",
    email: "",
    codigo: "",
    activo: true,
  })

  const resetForm = () => {
    setNuevoCliente({
      nombre: "",
      telefono: "",
      email: "",
      codigo: "",
      activo: true,
    })
    setEditingCliente(null)
  }

  const handleInputChange = (field: string, value: string) => {
    let processedValue = value

    if (field === "nombre") {
      // Solo letras, espacios, acentos y ñ, convertir a mayúsculas
      processedValue = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "").toUpperCase()
    } 
    else if (field === "codigo") {
      // Solo números, máximo 4 caracteres
      processedValue = value.replace(/\D/g, "").slice(0, 4)
    }

    setNuevoCliente((prev) => ({
      ...prev,
      [field]: processedValue,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const clienteData = {
        nombre: nuevoCliente.nombre,
        telefono: nuevoCliente.telefono,
        email: nuevoCliente.email,
        codigo: nuevoCliente.codigo || null,
        activo: nuevoCliente.activo,
      }

      if (editingCliente) {
        const { error } = await supabase.from("clientes").update(clienteData).eq("id", editingCliente.id)

        if (error) throw error

        toast({
          title: "Éxito",
          description: "Cliente actualizado correctamente",
        })
      } else {
        const { error } = await supabase.from("clientes").insert([clienteData])

        if (error) throw error

        toast({
          title: "Éxito",
          description: "Cliente creado correctamente",
        })
      }

      await refreshClientes()
      
      setDialogOpen(false)
      resetForm()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al guardar el cliente",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setNuevoCliente({
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      email: cliente.email,
      codigo: cliente.codigo || "",
      activo: cliente.activo,
    })
    setDialogOpen(true)
  }

const checkClienteHasUsuarios = async (clienteId: number): Promise<boolean> => {
  try {
    // Try different possible column names that might reference the client
    const possibleColumns = ['cliente_id', 'client_id', 'id_cliente']
    
    for (const columnName of possibleColumns) {
      try {
        const { data, error } = await supabase
          .from("cuentas")
          .select("id")
          .eq(columnName, clienteId)
          .limit(1)

        if (!error && data && data.length > 0) {
          return true
        }
      } catch (columnError) {
        // Continue to next column if this one doesn't exist
        continue
      }
    }
    
    return false
  } catch (error) {
    console.error("Error checking client users:", error)
    return false
  }
}

  const handleDelete = async (id: number) => {
    try {
      // Check if client has assigned users
      const hasUsuarios = await checkClienteHasUsuarios(id)
    
      if (hasUsuarios) {
        alert("Este cliente tiene usuarios asignados en cuentas. Elimina primero los usuarios antes de eliminar el cliente.")
        return
      }

      if (!confirm("¿Estás seguro de que quieres eliminar este cliente?")) return

      const { error } = await supabase.from("clientes").delete().eq("id", id)

      if (error) throw error

      toast({
        title: "Éxito",
        description: "Cliente eliminado correctamente",
      })

      await refreshClientes()
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el cliente",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedClientes.length === 0) return

    try {
      // Check if any selected client has assigned users
      const clientesConUsuarios = []
      for (const clienteId of selectedClientes) {
        const hasUsuarios = await checkClienteHasUsuarios(clienteId)
        if (hasUsuarios) {
          const cliente = clientes.find(c => c.id === clienteId)
          if (cliente) clientesConUsuarios.push(cliente.nombre)
        }
      }

      if (clientesConUsuarios.length > 0) {
        alert(`Los siguientes clientes tienen usuarios asignados en cuentas: ${clientesConUsuarios.join(", ")}. Elimina primero los usuarios antes de eliminar estos clientes.`)
        return
      }

      if (!confirm(`¿Estás seguro de que quieres eliminar estos ${selectedClientes.length} clientes?`))
        return

      const { error } = await supabase.from("clientes").delete().in("id", selectedClientes)

      if (error) throw error

      toast({
        title: "Éxito",
        description: `${selectedClientes.length} clientes eliminados correctamente`,
      })

      setSelectedClientes([])
      await refreshClientes()
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar los clientes",
        variant: "destructive",
      })
    }
  }

  const handleSelectCliente = (clienteId: number, checked: boolean) => {
    if (checked) {
      setSelectedClientes((prev) => [...prev, clienteId])
    } else {
      setSelectedClientes((prev) => prev.filter((id) => id !== clienteId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClientes(filteredClientes.map((c) => c.id))
    } else {
      setSelectedClientes([])
    }
  }

const exportToCSV = () => {
  const csvData = filteredClientes.map(cliente => ({
    Nombre: cliente.nombre,
    Telefono: cliente.telefono,
    'Correo electrónico': cliente.email,
    Codigo: cliente.codigo || 'Sin código'
  }))

  const csvContent = [
    Object.keys(csvData[0]).join(','),
    ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const exportToExcel = () => {
  const excelData = filteredClientes.map(cliente => ({
    Nombre: cliente.nombre,
    Telefono: cliente.telefono,
    'Correo electrónico': cliente.email,
    Codigo: cliente.codigo || 'Sin código'
  }))

  const ws = XLSX.utils.json_to_sheet(excelData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
  
  // Use writeFileXLSX instead of writeFile for browser compatibility
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `clientes_${new Date().toISOString().split('T')[0]}.xlsx`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

  const filteredClientes = clientes.filter(
    (cliente) =>
      cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.telefono.includes(searchTerm) ||
      cliente.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cliente.codigo && cliente.codigo.includes(searchTerm)),
  )

  const allSelected = filteredClientes.length > 0 && selectedClientes.length === filteredClientes.length
  const someSelected = selectedClientes.length > 0 && selectedClientes.length < filteredClientes.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Clientes</h2>
          <p className="text-muted-foreground">Administra la información de tus clientes</p>
        </div>

        <div className="flex gap-2">
          {selectedClientes.length > 0 && (
            <Button variant="destructive" onClick={handleDeleteSelected} className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Eliminar Clientes ({selectedClientes.length})
            </Button>
          )}

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingCliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
                <DialogDescription>
                  {editingCliente ? "Modifica los datos del cliente" : "Agrega un nuevo cliente al sistema"}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="nombre" className="text-right">
                    Nombre*
                  </Label>
                  <Input
                    id="nombre"
                    value={nuevoCliente.nombre}
                    onChange={(e) => handleInputChange("nombre", e.target.value)}
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
                    value={nuevoCliente.telefono}
                    onChange={(e) => handleInputChange("telefono", e.target.value)}
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
                    value={nuevoCliente.email}
                    onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                    className="col-span-3"
                    placeholder="ejemplo@gmail.com"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="codigo" className="text-right">
                    Codigo*
                  </Label>
                  <Input
                    id="codigo"
                    value={nuevoCliente.codigo}
                    onChange={(e) => handleInputChange("codigo", e.target.value)}
                    className="col-span-3"
                    placeholder="1234"
                    minLength={4}
                    maxLength={4}
                    required
                  />
                </div>

                {/*CODIGO DE CLIENTE ACTIVO

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="activo" className="text-right">
                    Activo
                  </Label>
                  <Switch
                    id="activo"
                    checked={nuevoCliente.activo}
                    onCheckedChange={(checked) => setNuevoCliente({ ...nuevoCliente, activo: checked })}
                  />
                </div>
                */}

                <DialogFooter>
                  <Button type="submit" disabled={nuevoCliente.codigo.length !== 4}>
                    {editingCliente ? "Actualizar" : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lista de Clientes ({filteredClientes.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              onClick={exportToCSV}
              className="flex items-center gap-2"
            >
              Descargar CSV
            </Button>
            <Button
              variant="outline"
              onClick={exportToExcel}
              className="flex items-center gap-2"
            >
              Descargar Excel
            </Button>
          </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredClientes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-lg">Nombre</TableHead>
                  <TableHead className="text-lg">Telefono</TableHead>
                  <TableHead className="text-lg">Correo electrónico</TableHead>
                  <TableHead className="text-lg">Codigo</TableHead>
                  {/*<TableHead>Estado</TableHead>*/}
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedClientes.includes(cliente.id)}
                        onCheckedChange={(checked) => handleSelectCliente(cliente.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{cliente.nombre}</TableCell>
                    <TableCell>{cliente.telefono}</TableCell>
                    <TableCell>{cliente.email}</TableCell>
                    <TableCell>
                      {cliente.codigo ? (
                        <Badge variant="outline">{cliente.codigo}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Sin código</span>
                      )}
                    </TableCell>
                    {/*<TableCell>
                      <Badge variant={cliente.activo ? "default" : "secondary"}>
                        {cliente.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>*/}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(cliente)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(cliente.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay clientes</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm ? "No se encontraron clientes con ese criterio" : "Comienza agregando tu primer cliente"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Cliente
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
