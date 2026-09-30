// Configuración de complejos, canchas y horarios.
// Para sumar/renombrar una cancha o cambiar un horario, se edita solo este archivo.
// Los contactos de la imagen se editan desde la app (tabla reservas_contactos).

export type ComplejoId = 'el-clasico' | 'el-clasico-2'

export interface Complejo {
  id: ComplejoId
  nombre: string            // como se muestra en la app
  tituloImagen: string      // segunda línea del título de la imagen
  canchas: string[]         // el orden es el de las columnas
  horarios: string[]        // HH:MM
  estilo: 'cesped' | 'noche' // diseño de la imagen
}

const HORARIOS = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00', '20:30', '22:00', '23:30']

export const COMPLEJOS: Complejo[] = [
  {
    id: 'el-clasico',
    nombre: 'El Clásico',
    tituloImagen: 'EL CLÁSICO',
    canchas: ['BX1', 'BX2', 'C1'],
    horarios: HORARIOS,
    estilo: 'cesped',
  },
  {
    id: 'el-clasico-2',
    nombre: 'El Clásico 2',
    tituloImagen: 'EL CLÁSICO 2',
    canchas: ['Cancha 1'],
    horarios: HORARIOS,
    estilo: 'noche',
  },
]

export const complejoPorId = (id: ComplejoId) => COMPLEJOS.find((c) => c.id === id)!