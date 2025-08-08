import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Función para formatear nombres de cuentas usando solo la primera palabra
export function formatearNombreCuenta(nombreCompleto: string): string {
  if (!nombreCompleto) return ""

  const palabras = nombreCompleto.trim().split(/[\s-_]+/)

  // Casos especiales donde queremos la segunda palabra
  const casosEspeciales: { [key: string]: string } = {
    "prime video": "Prime",
    "amazon prime": "Amazon",
    "disney plus": "Disney",
    "hbo max": "HBO",
    "youtube premium": "YouTube",
    "apple tv": "Apple",
  }

  const nombreLower = nombreCompleto.toLowerCase()

  // Verificar casos especiales
  for (const [caso, resultado] of Object.entries(casosEspeciales)) {
    if (nombreLower.includes(caso)) {
      return resultado
    }
  }

  // Si no es caso especial, usar la primera palabra capitalizada
  return palabras[0] ? palabras[0].charAt(0).toUpperCase() + palabras[0].slice(1) : nombreCompleto
}

// Función para calcular fecha de vencimiento (un mes después)
export function calcularFechaVencimiento(fechaContratacion: string): string {
  const fecha = new Date(fechaContratacion)

  // Agregar un mes
  const mesVencimiento = fecha.getMonth() + 1
  const añoVencimiento = fecha.getFullYear() + Math.floor(mesVencimiento / 12)
  const mesAjustado = mesVencimiento % 12

  // Obtener el día original
  const diaOriginal = fecha.getDate()

  // Crear fecha tentativa
  const fechaTentativa = new Date(añoVencimiento, mesAjustado, 1)

  // Obtener el último día del mes de vencimiento
  const ultimoDiaDelMes = new Date(añoVencimiento, mesAjustado + 1, 0).getDate()

  // Ajustar el día si es necesario
  const diaFinal = Math.min(diaOriginal, ultimoDiaDelMes)

  // Crear fecha final
  const fechaVencimiento = new Date(añoVencimiento, mesAjustado, diaFinal)

  return fechaVencimiento.toISOString().split("T")[0]
}

// Función para obtener el color del estado de vencimiento
export function getVencimientoColor(fecha?: string) {
  if (!fecha) return "secondary"

  const hoy = new Date()
  const vencimiento = new Date(fecha)
  const diffDays = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "destructive"
  if (diffDays <= 7) return "destructive"
  if (diffDays <= 30) return "default"
  return "secondary"
}

// Función para calcular margen de ganancia
export function calcularMargenGanancia(precioBase: number, precioCliente: number): number {
  if (precioBase === 0) return 0
  return ((precioCliente - precioBase) / precioBase) * 100
}
