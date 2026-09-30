/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de El Clásico
        noche: '#0D053E',     // índigo del logo
        escudo: '#0E599C',    // azul del escudo
        pelota: '#D2DA1F',    // amarillo de la pelota
        rojo: '#D7262E',      // rojo del escudo -> turno reservado
        cesped: '#1F7A3A',    // verde de la cinta -> turno libre
        niebla: '#F2F1F8',
        tinta: '#5D5A78',
        linea: '#CFD2E3',
      },
      fontFamily: {
        tablero: ['"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
