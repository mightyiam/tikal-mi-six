import ghd = require('geodetic-haversine-distance')

interface LongForm {
  latitude: number
  longitude: number
}

const NUMBER_10: LongForm = {latitude: 51.503396, longitude: -0.12764} // https://en.wikipedia.org/wiki/10_Downing_Street

interface ShortForm { lat: number, lng: number }

const toLongForm = (pos: LongForm | ShortForm): LongForm => {
  if ((pos as LongForm).longitude) {
    return pos as LongForm
  }
  return {
    latitude: (pos as ShortForm).lat,
    longitude: (pos as ShortForm).lng
  }
}

export default (pos: ShortForm | LongForm) => (
  Math.round(ghd(toLongForm(pos), NUMBER_10) / 1000)
)
