declare module 'formatcoords' {
  interface Coords {
    lat: number
    lng: number
  }
  interface Formatter {
    format: () => string
  }
  const formatcoords: (coords: Coords) => Formatter
  export = formatcoords
}
