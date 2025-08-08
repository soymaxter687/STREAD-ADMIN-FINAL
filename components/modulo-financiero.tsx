"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PiggyBank,
  Calculator,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react"

interface ResumenFinancieroMensual {
  año: number
  mes: number
  mes_nombre: string
  inversion_total: number
  ingresos_totales: number
  utilidad: number
  margen_utilidad_porcentaje: number
}

interface FinancieroPorServicio {
  servicio_nombre: string
  servicio_emoji: string
  año: number
  mes: number
  inversion_total: number
  ingresos_totales: number
  utilidad: number
  cuentas_activas: number
  perfiles_ocupados: number
}

interface ResumenFinanciero {
  periodo: string
  inversion_total: number
  ingresos_totales: number
  utilidad: number
  margen_utilidad_porcentaje: number
  cuentas_creadas: number
  perfiles_asignados: number
}

export function ModuloFinanciero() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [resumenMensual, setResumenMensual] = useState<ResumenFinancieroMensual[]>([])
  const [financieroPorServicio, setFinancieroPorServicio] = useState<FinancieroPorServicio[]>([])
  const [resumenActual, setResumenActual] = useState<ResumenFinanciero | null>(null)

  // Filtros
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState<string>("todos")

  // Obtener años disponibles
  const currentYear = new Date().getFullYear()
  const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const meses = [
    { value: "todos", label: "Todos los meses" },
    { value: "1", label: "Enero" },
    { value: "2", label: "Febrero" },
    { value: "3", label: "Marzo" },
    { value: "4", label: "Abril" },
    { value: "5", label: "Mayo" },
    { value: "6", label: "Junio" },
    { value: "7", label: "Julio" },
    { value: "8", label: "Agosto" },
    { value: "9", label: "Septiembre" },
    { value: "10", label: "Octubre" },
    { value: "11", label: "Noviembre" },
    { value: "12", label: "Diciembre" },
  ]

  const getNombreMes = (numeroMes: number): string => {
    const nombres = [
      "",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ]
    return nombres[numeroMes] || `Mes ${numeroMes}`
  }

  // Cargar datos financieros usando consultas directas
  const loadFinancialDataDirect = async () => {
    try {
      setLoading(true)

      // Verificar si las tablas financieras existen
      const { data: tablesCheck } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .in("table_name", ["inversiones", "ingresos"])

      if (!tablesCheck || tablesCheck.length < 2) {
        // Si no existen las tablas financieras, usar datos simulados basados en cuentas y asignaciones
        await loadFinancialDataFromExisting()
        return
      }

      const añoFiltro = Number.parseInt(selectedYear)
      const mesFiltro = selectedMonth === "todos" ? null : Number.parseInt(selectedMonth)

      // Cargar inversiones
      let inversionesQuery = supabase
        .from("inversiones")
        .select(`
          *,
          cuenta:cuentas(nombre),
          servicio:servicios(nombre, emoji)
        `)
        .eq("año_inversion", añoFiltro)
        .eq("activa", true)

      if (mesFiltro) {
        inversionesQuery = inversionesQuery.eq("mes_inversion", mesFiltro)
      }

      const { data: inversionesData, error: inversionesError } = await inversionesQuery

      // Cargar ingresos
      let ingresosQuery = supabase
        .from("ingresos")
        .select(`
          *,
          cuenta:cuentas(nombre),
          servicio:servicios(nombre, emoji),
          cliente:clientes(nombre)
        `)
        .eq("año_ingreso", añoFiltro)
        .eq("activo", true)

      if (mesFiltro) {
        ingresosQuery = ingresosQuery.eq("mes_ingreso", mesFiltro)
      }

      const { data: ingresosData, error: ingresosError } = await ingresosQuery

      if (inversionesError || ingresosError) {
        console.warn("Error loading from financial tables, using fallback method")
        await loadFinancialDataFromExisting()
        return
      }

      // Procesar datos para resumen mensual
      const resumenPorMes: { [key: string]: any } = {}

      // Procesar inversiones
      inversionesData?.forEach((inversion) => {
        const key = `${inversion.año_inversion}-${inversion.mes_inversion}`
        if (!resumenPorMes[key]) {
          resumenPorMes[key] = {
            año: inversion.año_inversion,
            mes: inversion.mes_inversion,
            mes_nombre: getNombreMes(inversion.mes_inversion),
            inversion_total: 0,
            ingresos_totales: 0,
            utilidad: 0,
            margen_utilidad_porcentaje: 0,
          }
        }
        resumenPorMes[key].inversion_total += inversion.monto_inversion
      })

      // Procesar ingresos
      ingresosData?.forEach((ingreso) => {
        const key = `${ingreso.año_ingreso}-${ingreso.mes_ingreso}`
        if (!resumenPorMes[key]) {
          resumenPorMes[key] = {
            año: ingreso.año_ingreso,
            mes: ingreso.mes_ingreso,
            mes_nombre: getNombreMes(ingreso.mes_ingreso),
            inversion_total: 0,
            ingresos_totales: 0,
            utilidad: 0,
            margen_utilidad_porcentaje: 0,
          }
        }
        resumenPorMes[key].ingresos_totales += ingreso.monto_ingreso
      })

      // Calcular utilidades y márgenes
      Object.values(resumenPorMes).forEach((resumen: any) => {
        resumen.utilidad = resumen.ingresos_totales - resumen.inversion_total
        resumen.margen_utilidad_porcentaje =
          resumen.inversion_total > 0 ? (resumen.utilidad / resumen.inversion_total) * 100 : 0
      })

      const resumenMensualArray = Object.values(resumenPorMes).sort((a: any, b: any) => {
        if (a.año !== b.año) return b.año - a.año
        return b.mes - a.mes
      })

      setResumenMensual(resumenMensualArray as ResumenFinancieroMensual[])

      // Calcular resumen actual
      const totalInversiones = inversionesData?.reduce((sum, inv) => sum + inv.monto_inversion, 0) || 0
      const totalIngresos = ingresosData?.reduce((sum, ing) => sum + ing.monto_ingreso, 0) || 0
      const utilidad = totalIngresos - totalInversiones
      const margenUtilidad = totalInversiones > 0 ? (utilidad / totalInversiones) * 100 : 0

      const periodo = mesFiltro ? `${getNombreMes(mesFiltro)} ${añoFiltro}` : añoFiltro.toString()

      setResumenActual({
        periodo,
        inversion_total: totalInversiones,
        ingresos_totales: totalIngresos,
        utilidad,
        margen_utilidad_porcentaje: margenUtilidad,
        cuentas_creadas: inversionesData?.length || 0,
        perfiles_asignados: ingresosData?.length || 0,
      })

      // Procesar datos por servicio (simplificado)
      const serviciosMap: { [key: string]: any } = {}

      inversionesData?.forEach((inversion) => {
        const servicioNombre = inversion.servicio?.nombre || "Sin servicio"
        const key = `${servicioNombre}-${inversion.año_inversion}-${inversion.mes_inversion}`

        if (!serviciosMap[key]) {
          serviciosMap[key] = {
            servicio_nombre: servicioNombre,
            servicio_emoji: inversion.servicio?.emoji || "📺",
            año: inversion.año_inversion,
            mes: inversion.mes_inversion,
            inversion_total: 0,
            ingresos_totales: 0,
            utilidad: 0,
            cuentas_activas: 0,
            perfiles_ocupados: 0,
          }
        }
        serviciosMap[key].inversion_total += inversion.monto_inversion
        serviciosMap[key].cuentas_activas += 1
      })

      ingresosData?.forEach((ingreso) => {
        const servicioNombre = ingreso.servicio?.nombre || "Sin servicio"
        const key = `${servicioNombre}-${ingreso.año_ingreso}-${ingreso.mes_ingreso}`

        if (serviciosMap[key]) {
          serviciosMap[key].ingresos_totales += ingreso.monto_ingreso
          serviciosMap[key].perfiles_ocupados += 1
        }
      })

      Object.values(serviciosMap).forEach((servicio: any) => {
        servicio.utilidad = servicio.ingresos_totales - servicio.inversion_total
      })

      setFinancieroPorServicio(Object.values(serviciosMap) as FinancieroPorServicio[])
    } catch (error: any) {
      console.error("Error loading financial data:", error)
      // Fallback a método alternativo
      await loadFinancialDataFromExisting()
    } finally {
      setLoading(false)
    }
  }

  // Método alternativo usando datos existentes de cuentas y asignaciones
  const loadFinancialDataFromExisting = async () => {
    try {
      const añoFiltro = Number.parseInt(selectedYear)
      const mesFiltro = selectedMonth === "todos" ? null : Number.parseInt(selectedMonth)

      // Obtener cuentas como inversiones
      const { data: cuentasData, error: cuentasError } = await supabase
        .from("cuentas")
        .select(`
          *,
          servicio:servicios(nombre, emoji)
        `)
        .eq("activa", true)

      // Obtener asignaciones como ingresos
      const { data: asignacionesData, error: asignacionesError } = await supabase
        .from("usuarios_asignaciones")
        .select(`
          *,
          cliente:clientes(nombre),
          cuenta_usuario:cuenta_usuarios(
            *,
            cuenta:cuentas(*),
            servicio:servicios(nombre, emoji)
          )
        `)
        .eq("activa", true)

      if (cuentasError || asignacionesError) {
        throw new Error("Error loading existing data")
      }

      // Filtrar por año y mes
      const cuentasFiltradas =
        cuentasData?.filter((cuenta) => {
          const fechaCreacion = new Date(cuenta.created_at)
          const añoCreacion = fechaCreacion.getFullYear()
          const mesCreacion = fechaCreacion.getMonth() + 1

          if (añoCreacion !== añoFiltro) return false
          if (mesFiltro && mesCreacion !== mesFiltro) return false
          return true
        }) || []

      const asignacionesFiltradas =
        asignacionesData?.filter((asignacion) => {
          const fechaContratacion = new Date(asignacion.fecha_contratacion)
          const añoContratacion = fechaContratacion.getFullYear()
          const mesContratacion = fechaContratacion.getMonth() + 1

          if (añoContratacion !== añoFiltro) return false
          if (mesFiltro && mesContratacion !== mesFiltro) return false
          return true
        }) || []

      // Calcular totales
      const totalInversiones = cuentasFiltradas.reduce(
        (sum, cuenta) => sum + (cuenta.precio_base || cuenta.precio_mensual),
        0,
      )
      const totalIngresos = asignacionesFiltradas.reduce((sum, asignacion) => sum + asignacion.costo_suscripcion, 0)
      const utilidad = totalIngresos - totalInversiones
      const margenUtilidad = totalInversiones > 0 ? (utilidad / totalInversiones) * 100 : 0

      const periodo = mesFiltro ? `${getNombreMes(mesFiltro)} ${añoFiltro}` : añoFiltro.toString()

      setResumenActual({
        periodo,
        inversion_total: totalInversiones,
        ingresos_totales: totalIngresos,
        utilidad,
        margen_utilidad_porcentaje: margenUtilidad,
        cuentas_creadas: cuentasFiltradas.length,
        perfiles_asignados: asignacionesFiltradas.length,
      })

      // Crear resumen mensual simplificado
      const resumenMensualSimple: ResumenFinancieroMensual[] = []

      if (mesFiltro) {
        // Solo el mes seleccionado
        resumenMensualSimple.push({
          año: añoFiltro,
          mes: mesFiltro,
          mes_nombre: getNombreMes(mesFiltro),
          inversion_total: totalInversiones,
          ingresos_totales: totalIngresos,
          utilidad,
          margen_utilidad_porcentaje: margenUtilidad,
        })
      } else {
        // Todos los meses del año
        for (let mes = 1; mes <= 12; mes++) {
          const cuentasDelMes =
            cuentasData?.filter((cuenta) => {
              const fechaCreacion = new Date(cuenta.created_at)
              return fechaCreacion.getFullYear() === añoFiltro && fechaCreacion.getMonth() + 1 === mes
            }) || []

          const asignacionesDelMes =
            asignacionesData?.filter((asignacion) => {
              const fechaContratacion = new Date(asignacion.fecha_contratacion)
              return fechaContratacion.getFullYear() === añoFiltro && fechaContratacion.getMonth() + 1 === mes
            }) || []

          const inversionMes = cuentasDelMes.reduce(
            (sum, cuenta) => sum + (cuenta.precio_base || cuenta.precio_mensual),
            0,
          )
          const ingresoMes = asignacionesDelMes.reduce((sum, asignacion) => sum + asignacion.costo_suscripcion, 0)
          const utilidadMes = ingresoMes - inversionMes
          const margenMes = inversionMes > 0 ? (utilidadMes / inversionMes) * 100 : 0

          if (inversionMes > 0 || ingresoMes > 0) {
            resumenMensualSimple.push({
              año: añoFiltro,
              mes,
              mes_nombre: getNombreMes(mes),
              inversion_total: inversionMes,
              ingresos_totales: ingresoMes,
              utilidad: utilidadMes,
              margen_utilidad_porcentaje: margenMes,
            })
          }
        }
      }

      setResumenMensual(resumenMensualSimple.sort((a, b) => b.mes - a.mes))
      setFinancieroPorServicio([]) // Simplificado por ahora
    } catch (error: any) {
      console.error("Error in fallback method:", error)
      toast({
        title: "Error",
        description:
          "No se pudieron cargar los datos financieros. Asegúrate de que las tablas estén configuradas correctamente.",
        variant: "destructive",
      })
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadFinancialDataDirect()
    setRefreshing(false)
  }

  useEffect(() => {
    loadFinancialDataDirect()
  }, [selectedYear, selectedMonth])

  // Exportar datos financieros
  const exportFinancialData = async () => {
    try {
      const headers = ["Mes", "Año", "Inversión Total", "Ingresos Totales", "Utilidad", "Margen %"]

      const csvContent = [
        headers.join(","),
        ...resumenMensual.map((item) =>
          [
            `"${item.mes_nombre}"`,
            item.año,
            item.inversion_total.toFixed(2),
            item.ingresos_totales.toFixed(2),
            item.utilidad.toFixed(2),
            item.margen_utilidad_porcentaje.toFixed(2),
          ].join(","),
        ),
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `resumen_financiero_${selectedYear}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Éxito",
        description: "Datos financieros exportados correctamente",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Error al exportar datos financieros",
        variant: "destructive",
      })
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const getUtilityColor = (utility: number) => {
    if (utility > 0) return "text-green-600"
    if (utility < 0) return "text-red-600"
    return "text-gray-600"
  }

  const getUtilityIcon = (utility: number) => {
    if (utility > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (utility < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Calculator className="h-4 w-4 text-gray-600" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando datos financieros...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">📊 Módulo Financiero</h2>
          <p className="text-muted-foreground">Control completo de inversiones, ingresos y utilidades</p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meses.map((mes) => (
                <SelectItem key={mes.value} value={mes.value}>
                  {mes.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={exportFinancialData} variant="outline">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar
          </Button>

          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Alerta sobre configuración */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <Calculator className="h-5 w-5" />
            Configuración del Módulo Financiero
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-blue-700 dark:text-blue-300 mb-3">
            Para obtener el máximo rendimiento del módulo financiero, ejecuta el script SQL correspondiente.
          </p>
          <div className="text-sm text-blue-600 dark:text-blue-400">
            <strong>Mientras tanto:</strong> Los datos se calculan basándose en las cuentas creadas (inversiones) y
            usuarios asignados (ingresos).
          </div>
        </CardContent>
      </Card>

      {/* Resumen del período actual */}
      {resumenActual && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(resumenActual.inversion_total)}</div>
              <p className="text-xs text-muted-foreground">
                {resumenActual.cuentas_creadas} cuenta{resumenActual.cuentas_creadas !== 1 ? "s" : ""} creada
                {resumenActual.cuentas_creadas !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(resumenActual.ingresos_totales)}</div>
              <p className="text-xs text-muted-foreground">
                {resumenActual.perfiles_asignados} perfil{resumenActual.perfiles_asignados !== 1 ? "es" : ""} asignado
                {resumenActual.perfiles_asignados !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilidad</CardTitle>
              {getUtilityIcon(resumenActual.utilidad)}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUtilityColor(resumenActual.utilidad)}`}>
                {formatCurrency(resumenActual.utilidad)}
              </div>
              <p className="text-xs text-muted-foreground">{resumenActual.periodo}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margen de Utilidad</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUtilityColor(resumenActual.utilidad)}`}>
                {resumenActual.margen_utilidad_porcentaje.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Rentabilidad sobre inversión</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs para diferentes vistas */}
      <Tabs defaultValue="mensual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mensual">Resumen Mensual</TabsTrigger>
          <TabsTrigger value="servicios">Por Servicio</TabsTrigger>
        </TabsList>

        <TabsContent value="mensual">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Resumen Financiero Mensual - {selectedYear}
              </CardTitle>
              <CardDescription>Evolución mensual de inversiones, ingresos y utilidades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead className="text-right">Inversión Total</TableHead>
                      <TableHead className="text-right">Ingresos Totales</TableHead>
                      <TableHead className="text-right">Utilidad</TableHead>
                      <TableHead className="text-right">Margen %</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumenMensual.map((item) => (
                      <TableRow key={`${item.año}-${item.mes}`}>
                        <TableCell className="font-medium">
                          {item.mes_nombre} {item.año}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {formatCurrency(item.inversion_total)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                          {formatCurrency(item.ingresos_totales)}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${getUtilityColor(item.utilidad)}`}>
                          {formatCurrency(item.utilidad)}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${getUtilityColor(item.utilidad)}`}>
                          {item.margen_utilidad_porcentaje.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={item.utilidad > 0 ? "default" : item.utilidad < 0 ? "destructive" : "secondary"}
                          >
                            {item.utilidad > 0 ? "Ganancia" : item.utilidad < 0 ? "Pérdida" : "Equilibrio"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {resumenMensual.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay datos financieros</h3>
                    <p className="text-muted-foreground text-center">
                      Los datos aparecerán cuando se creen cuentas y se asignen usuarios en {selectedYear}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="servicios">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Análisis por Servicio - {selectedYear}
              </CardTitle>
              <CardDescription>Rendimiento financiero desglosado por cada servicio digital</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Análisis por Servicio</h3>
                <p className="text-muted-foreground text-center">
                  Esta funcionalidad estará disponible después de ejecutar el script SQL del módulo financiero
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
