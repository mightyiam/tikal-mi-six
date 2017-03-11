declare module 'geodetic-haversine-distance' {
  interface Position {
    latitude: number
    longitude: number
  }
  const haversineDistance: (a: Position, b: Position) => number
  export = haversineDistance
}
