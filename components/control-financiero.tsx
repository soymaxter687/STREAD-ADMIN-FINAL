"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  supabase,
  type ResumenFinancieroMensual,
  type ResumenFinancieroGlobal,
  type ResumenPeriodo,
  type MovimientoFinanciero,
} from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import {
  TrendingUp,
  TrendingDown,
  Calculator,
  Calendar,
  BarChart3,
  FileSpreadsheet,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  Target,
  Activity,
  AlertCircle,
  CheckCircle,
} from "lucide-react"

export function ControlFinanciero() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Estados para datos
  const [resumenGlobal, setResumenGlobal] = useState<ResumenFinancieroGlobal | null>(null)
  const [resumenMensual, setResumenMensual] = useState<ResumenFinancieroMensual[]>([])
  const [resumenPeriodo, setResumenPeriodo] = useState<ResumenPeriodo | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoFinanciero[]>([])
  const [sistemConfigurado, setSistemaConfigurado] = useState(false)

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

  // Cargar datos financieros
  const loadFinancialData = async () => {
    try {
      setLoading(true)

      // Verificar si existe la tabla de movimientos financieros
      const { data: tableCheck } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_name", "movimientos_financieros")
        .single()

      if (!tableCheck) {
        setSistemaConfigurado(false)
        await loadFinancialDataFallback()
        return
      }

      setSistemaConfigurado(true)

      // Cargar resumen global
      const { data: globalData, error: globalError } = await supabase
        .from("vista_resumen_financiero_global")
        .select("*")
        .single()

      if (globalError && globalError.code !== "PGRST116") {
        console.warn("Error loading global summary:", globalError)
        await loadFinancialDataFallback()
        return
      }

      setResumenGlobal(globalData)

      // Cargar resumen mensual
      const { data: mensualData, error: mensualError } = await supabase
        .from("vista_resumen_financiero_mensual")
        .select("*")
        .eq("año", Number.parseInt(selectedYear))
        .order("mes", { ascending: false })

      if (mensualError) {
        console.warn("Error loading monthly summary:", mensualError)
      } else {
        setResumenMensual(mensualData || [])
      }

      // Cargar resumen del período específico
      const añoParam = Number.parseInt(selectedYear)
      const mesParam = selectedMonth === "todos" ? null : Number.parseInt(selectedMonth)

      const { data: periodoData, error: periodoError } = await supabase
        .rpc("obtener_resumen_periodo", {
          año_param: añoParam,
          mes_param: mesParam,
        })
        .single()

      if (periodoError) {
        console.warn("Error loading period summary:", periodoError)
      } else {
        setResumenPeriodo(periodoData)
      }

      // Cargar movimientos recientes
      let movimientosQuery = supabase
        .from("movimientos_financieros")
        .select("*")
        .eq("año", añoParam)
        .order("fecha", { ascending: false })
        .limit(100)

      if (mesParam) {
        movimientosQuery = movimientosQuery.eq("mes", mesParam)
      }

      const { data: movimientosData, error: movimientosError } = await movimientosQuery

      if (!movimientosError) {
        setMovimientos(movimientosData || [])
      }

      // Verificar que hay datos
      if (globalData && (globalData.gastos_totales > 0 || globalData.ventas_totales > 0)) {
        toast({
          title: "✅ Sistema Configurado",
          description: `Gastos: $${globalData.gastos_totales.toFixed(2)} | Ventas: $${globalData.ventas_totales.toFixed(2)}`,
        })
      }
    } catch (error: any) {
      console.error("Error loading financial data:", error)
      setSistemaConfigurado(false)
      await loadFinancialDataFallback()
    } finally {
      setLoading(false)
    }
  }

  // Método de respaldo usando datos existentes
  const loadFinancialDataFallback = async () => {
    try {
      const añoFiltro = Number.parseInt(selectedYear)
      const mesFiltro = selectedMonth === "todos" ? null : Number.parseInt(selectedMonth)

      // Obtener cuentas como gastos
      const { data: cuentasData, error: cuentasError } = await supabase
        .from("cuentas")
        .select("*, servicio:servicios(nombre, emoji)")

      // Obtener asignaciones como ventas
      const { data: asignacionesData, error: asignacionesError } = await supabase
        .from("usuarios_asignaciones")
        .select(`
          *,
          cliente:clientes(nombre),
          cuenta_usuario:cuenta_usuarios(
            *,
            cuenta:cuentas(nombre),
            servicio:servicios(nombre, emoji)
          )
        `)
        .eq("activa", true)

      if (cuentasError || asignacionesError) {
        throw new Error("Error loading fallback data")
      }

      // Calcular totales globales
      const totalGastos =
        cuentasData?.reduce((sum, cuenta) => sum + (cuenta.precio_base || cuenta.precio_mensual), 0) || 0

      const totalVentas = asignacionesData?.reduce((sum, asignacion) => sum + asignacion.costo_suscripcion, 0) || 0

      const utilidadGlobal = totalVentas - totalGastos
      const margenGlobal = totalGastos > 0 ? (utilidadGlobal / totalGastos) * 100 : 0

      setResumenGlobal({
        periodo: "Histórico Total",
        gastos_totales: totalGastos,
        ventas_totales: totalVentas,
        utilidad: utilidadGlobal,
        margen_utilidad_porcentaje: margenGlobal,
        cantidad_gastos: cuentasData?.length || 0,
        cantidad_ventas: asignacionesData?.length || 0,
        fecha_inicio: cuentasData?.[0]?.created_at || new Date().toISOString(),
        fecha_fin: new Date().toISOString(),
      })

      // Filtrar por período específico
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

      const gastosPeriodo = cuentasFiltradas.reduce(
        (sum, cuenta) => sum + (cuenta.precio_base || cuenta.precio_mensual),
        0,
      )
      const ventasPeriodo = asignacionesFiltradas.reduce((sum, asignacion) => sum + asignacion.costo_suscripcion, 0)
      const utilidadPeriodo = ventasPeriodo - gastosPeriodo
      const margenPeriodo = gastosPeriodo > 0 ? (utilidadPeriodo / gastosPeriodo) * 100 : 0

      const periodo = mesFiltro
        ? `${meses.find((m) => m.value === mesFiltro.toString())?.label} ${añoFiltro}`
        : añoFiltro.toString()

      setResumenPeriodo({
        periodo,
        gastos_totales: gastosPeriodo,
        ventas_totales: ventasPeriodo,
        utilidad: utilidadPeriodo,
        margen_utilidad_porcentaje: margenPeriodo,
        cantidad_gastos: cuentasFiltradas.length,
        cantidad_ventas: asignacionesFiltradas.length,
      })

      // Crear resumen mensual simplificado
      const resumenMensualSimple: ResumenFinancieroMensual[] = []

      if (mesFiltro) {
        resumenMensualSimple.push({
          año: añoFiltro,
          mes: mesFiltro,
          mes_nombre: meses.find((m) => m.value === mesFiltro.toString())?.label || `Mes ${mesFiltro}`,
          gastos_totales: gastosPeriodo,
          ventas_totales: ventasPeriodo,
          utilidad: utilidadPeriodo,
          margen_utilidad_porcentaje: margenPeriodo,
          cantidad_gastos: cuentasFiltradas.length,
          cantidad_ventas: asignacionesFiltradas.length,
        })
      } else {
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

          const gastosMes = cuentasDelMes.reduce(
            (sum, cuenta) => sum + (cuenta.precio_base || cuenta.precio_mensual),
            0,
          )
          const ventasMes = asignacionesDelMes.reduce((sum, asignacion) => sum + asignacion.costo_suscripcion, 0)
          const utilidadMes = ventasMes - gastosMes
          const margenMes = gastosMes > 0 ? (utilidadMes / gastosMes) * 100 : 0

          if (gastosMes > 0 || ventasMes > 0) {
            resumenMensualSimple.push({
              año: añoFiltro,
              mes,
              mes_nombre: meses.find((m) => m.value === mes.toString())?.label || `Mes ${mes}`,
              gastos_totales: gastosMes,
              ventas_totales: ventasMes,
              utilidad: utilidadMes,
              margen_utilidad_porcentaje: margenMes,
              cantidad_gastos: cuentasDelMes.length,
              cantidad_ventas: asignacionesDelMes.length,
            })
          }
        }
      }

      setResumenMensual(resumenMensualSimple.sort((a, b) => b.mes - a.mes))

      if (totalVentas === 0 && asignacionesData && asignacionesData.length > 0) {
        toast({
          title: "⚠️ Problema Detectado",
          description: `Hay ${asignacionesData.length} asignaciones pero ventas en $0. Ejecuta el script corregido.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error("Error in fallback method:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos financieros",
        variant: "destructive",
      })
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadFinancialData()
    setRefreshing(false)
  }

  useEffect(() => {
    loadFinancialData()
  }, [selectedYear, selectedMonth])

  // Exportar datos financieros
  const exportFinancialData = async () => {
    try {
      const headers = ["Mes", "Año", "Gastos", "Ventas", "Utilidad", "Margen %", "Cant. Gastos", "Cant. Ventas"]

      const csvContent = [
        headers.join(","),
        ...resumenMensual.map((item) =>
          [
            `"${item.mes_nombre}"`,
            item.año,
            item.gastos_totales.toFixed(2),
            item.ventas_totales.toFixed(2),
            item.utilidad.toFixed(2),
            item.margen_utilidad_porcentaje.toFixed(2),
            item.cantidad_gastos,
            item.cantidad_ventas,
          ].join(","),
        ),
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `control_financiero_${selectedYear}.csv`)
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
          <p>Cargando control financiero...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">💰 Control Financiero</h2>
          <p className="text-muted-foreground">Seguimiento automático de gastos, ventas y utilidades</p>
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

      {/* Estado del sistema */}
      <Card
        className={`border-2 ${sistemConfigurado ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" : "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950"}`}
      >
        <CardHeader>
          <CardTitle
            className={`flex items-center gap-2 ${sistemConfigurado ? "text-green-800 dark:text-green-200" : "text-orange-800 dark:text-orange-200"}`}
          >
            {sistemConfigurado ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            Estado del Sistema de Control Financiero
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sistemConfigurado ? (
            <div className="text-green-700 dark:text-green-300">
              <p className="mb-2">✅ Sistema configurado correctamente</p>
              <ul className="text-sm space-y-1">
                <li>• Los gastos se registran automáticamente al crear cuentas</li>
                <li>• Las ventas se registran automáticamente al asignar perfiles</li>
                <li>• Los registros son permanentes y no se eliminan</li>
                <li>• La utilidad se calcula automáticamente (Ventas - Gastos)</li>
              </ul>
            </div>
          ) : (
            <div className="text-orange-700 dark:text-orange-300">
              <p className="mb-2">⚠️ Sistema funcionando en modo básico</p>
              <p className="text-sm">
                Para obtener el máximo rendimiento, ejecuta el script de configuración completa.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen Global */}
      {resumenGlobal && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Resumen Global - {resumenGlobal.periodo}
            </CardTitle>
            <CardDescription>
              Desde {new Date(resumenGlobal.fecha_inicio).toLocaleDateString()} hasta{" "}
              {new Date(resumenGlobal.fecha_fin).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(resumenGlobal.gastos_totales)}</div>
                <p className="text-sm text-muted-foreground">Gastos Totales</p>
                <Badge variant="outline" className="mt-1">
                  {resumenGlobal.cantidad_gastos} cuentas
                </Badge>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(resumenGlobal.ventas_totales)}</div>
                <p className="text-sm text-muted-foreground">Ventas Totales</p>
                <Badge variant="outline" className="mt-1">
                  {resumenGlobal.cantidad_ventas} perfiles
                </Badge>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getUtilityColor(resumenGlobal.utilidad)}`}>
                  {formatCurrency(resumenGlobal.utilidad)}
                </div>
                <p className="text-sm text-muted-foreground">Utilidad Total</p>
                <Badge variant={resumenGlobal.utilidad > 0 ? "default" : "destructive"} className="mt-1">
                  {resumenGlobal.utilidad > 0 ? "Ganancia" : "Pérdida"}
                </Badge>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getUtilityColor(resumenGlobal.utilidad)}`}>
                  {resumenGlobal.margen_utilidad_porcentaje.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">Margen de Utilidad</p>
                <Badge variant="secondary" className="mt-1">
                  ROI Global
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen del Período Actual */}
      {resumenPeriodo && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gastos (Inversión)</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(resumenPeriodo.gastos_totales)}</div>
              <p className="text-xs text-muted-foreground">
                {resumenPeriodo.cantidad_gastos} cuenta{resumenPeriodo.cantidad_gastos !== 1 ? "s" : ""} creada
                {resumenPeriodo.cantidad_gastos !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventas (Ingresos)</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(resumenPeriodo.ventas_totales)}</div>
              <p className="text-xs text-muted-foreground">
                {resumenPeriodo.cantidad_ventas} perfil{resumenPeriodo.cantidad_ventas !== 1 ? "es" : ""} asignado
                {resumenPeriodo.cantidad_ventas !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilidad (Ganancia)</CardTitle>
              {getUtilityIcon(resumenPeriodo.utilidad)}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUtilityColor(resumenPeriodo.utilidad)}`}>
                {formatCurrency(resumenPeriodo.utilidad)}
              </div>
              <p className="text-xs text-muted-foreground">{resumenPeriodo.periodo}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margen de Utilidad</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getUtilityColor(resumenPeriodo.utilidad)}`}>
                {resumenPeriodo.margen_utilidad_porcentaje.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Rentabilidad sobre inversión</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs para diferentes vistas */}
      <Tabs defaultValue="mensual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mensual">Histórico Mensual</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos Recientes</TabsTrigger>
        </TabsList>

        <TabsContent value="mensual">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Histórico Mensual - {selectedYear}
              </CardTitle>
              <CardDescription>Evolución mensual de gastos, ventas y utilidades con cálculo automático</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                      <TableHead className="text-right">Ventas</TableHead>
                      <TableHead className="text-right">Utilidad</TableHead>
                      <TableHead className="text-right">Margen %</TableHead>
                      <TableHead className="text-center">Cuentas</TableHead>
                      <TableHead className="text-center">Perfiles</TableHead>
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
                          {formatCurrency(item.gastos_totales)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                          {formatCurrency(item.ventas_totales)}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${getUtilityColor(item.utilidad)}`}>
                          {formatCurrency(item.utilidad)}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${getUtilityColor(item.utilidad)}`}>
                          {item.margen_utilidad_porcentaje.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{item.cantidad_gastos}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{item.cantidad_ventas}</Badge>
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
                      Los datos aparecerán automáticamente cuando se creen cuentas y se asignen perfiles en{" "}
                      {selectedYear}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movimientos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Movimientos Recientes - {sistemConfigurado ? "Sistema Completo" : "Modo Básico"}
              </CardTitle>
              <CardDescription>
                {sistemConfigurado
                  ? "Registro automático de gastos y ventas del período seleccionado"
                  : "Para ver movimientos detallados, ejecuta el script de configuración completa"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sistemConfigurado ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimientos.map((movimiento) => (
                        <TableRow key={movimiento.id}>
                          <TableCell>{new Date(movimiento.fecha).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge
                              variant={movimiento.tipo === "gasto" ? "destructive" : "default"}
                              className="capitalize"
                            >
                              {movimiento.tipo === "gasto" ? (
                                <ArrowDownCircle className="h-3 w-3 mr-1" />
                              ) : (
                                <ArrowUpCircle className="h-3 w-3 mr-1" />
                              )}
                              {movimiento.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono ${
                              movimiento.tipo === "gasto" ? "text-red-600" : "text-blue-600"
                            }`}
                          >
                            {formatCurrency(movimiento.monto)}
                          </TableCell>
                          <TableCell className="text-sm">{movimiento.descripcion}</TableCell>
                          <TableCell>
                            <Badge variant={movimiento.activo ? "default" : "secondary"}>
                              {movimiento.activo ? "Activo" : "Histórico"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {movimientos.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No hay movimientos</h3>
                      <p className="text-muted-foreground text-center">
                        Los movimientos aparecerán automáticamente cuando se creen cuentas o se asignen perfiles
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-orange-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sistema en Modo Básico</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Para ver el registro detallado de movimientos, ejecuta el script de configuración completa
                  </p>
                  <Badge variant="outline">Funcionalidad limitada</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Información sobre automatización */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <Calculator className="h-5 w-5" />
            Sistema Automático de Control Financiero - CORREGIDO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">📉 Gastos (Inversión) - Permanentes</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Se registra automáticamente al crear una nueva cuenta</li>
                <li>• Usa el "precio base" o "costo de adquisición" de la cuenta</li>
                <li>
                  • <strong>PERMANENTE:</strong> No se elimina aunque borres la cuenta
                </li>
                <li>• La inversión ya se realizó y debe quedar registrada</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">📈 Ventas (Ingresos) - Automático</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Se registra automáticamente al asignar un perfil a un cliente</li>
                <li>• Usa el "costo de suscripción" configurado para el cliente</li>
                <li>• Se suma al mes correspondiente a la fecha de contratación</li>
                <li>
                  • <strong>CORREGIDO:</strong> Ahora detecta todas las asignaciones existentes
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>💡 Utilidad = Ventas - Gastos</strong> | Los registros son permanentes para mantener el historial
              financiero completo
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
