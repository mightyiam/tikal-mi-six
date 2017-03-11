export type LatLng = { lat: number; lng: number }

export interface Mission {
  country: string
  agent: string
  address: string
  date: string
}

export interface AddressWithData {
  address: string
  position: LatLng
  distanceToNumber10: number
}

export interface AddressesWithData {
  [address: string]: AddressWithData
}
