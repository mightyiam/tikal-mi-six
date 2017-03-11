import { DOMSource, div, p, a, table, tr, th, td } from '@cycle/dom'
import xs, { Stream } from 'xstream'
import dropUntil from 'xstream/extra/dropUntil'
import { Mission } from './interfaces'
import { AddressesWithData } from './interfaces'
import { VNode } from 'snabbdom/vnode'
import * as moment from 'moment'
import sortBy = require('lodash.sortby')
import dateFormat from './date-format'
import * as toDMS from 'formatcoords'

const loadingGeodata = () => p(
  { class: { 'geo-loading-indicator': true } },
  'retrieving…'
)

interface Sources {
  DOM: DOMSource,
  missions: Stream<Mission[]>,
  addressesWithData: Stream<AddressesWithData>
}

export default ({
  DOM,
  missions: missions$,
  addressesWithData: addressesWithData$
}: Sources) => {
  const dateSortedMissions$: Stream<Mission[]> = missions$.map((missions) => {
    return sortBy(missions, [function (mission: Mission): number {
      return moment(mission.date, dateFormat).unix()
    }])
  })

  const gotAllData$: Stream<null> = xs.combine(
    missions$,
    addressesWithData$
  ).filter(([
    missions,
    addressesWithData
  ]) => Object.keys(addressesWithData).length === missions.length)
  .mapTo(null)

  const shortestDistanceTo10$: Stream<null | number> = addressesWithData$
    .fold((shortestDistanceTo10, addressesWithData) => {
      return Object.values(addressesWithData).reduce((shortest, addressWithData) => {
        if (addressWithData === null) {
          return null
        }
        if (shortest === null) {
          return addressWithData.distanceToNumber10
        }
        const distanceToNumber10 = addressWithData.distanceToNumber10
        return distanceToNumber10 < shortest ? distanceToNumber10 : shortest
      }, null as null | number)
    }, null as null | number)
    .compose(dropUntil(gotAllData$))

  const vnode$: Stream<VNode> = xs.combine(
    dateSortedMissions$,
    addressesWithData$,
    shortestDistanceTo10$
  ).map(([
    dateSortedMissions,
    addressesWithData,
    shortestDistanceTo10
  ]) => {
    return div([
      p('The following table presents the missions data, sorted by date, oldest to most recent. The mission nearest 10 Downing st., London is printed in red. The farthest, in green.'),
      table(
        [
          tr([
            th('Agent ID'),
            th('Country'),
            th('Address'),
            th('Date'),
            th('Coordinates'),
            th('Distance to #10')
          ]),
          ...dateSortedMissions.map(({ agent, country, address, date }) => {
            const geoData = addressesWithData[address]
            return tr(
              { class: { ['is-nearest']: geoData && geoData.distanceToNumber10 === shortestDistanceTo10 } },
              [
                td(agent),
                td(country),
                td(address),
                td(date),
                td(!geoData ? loadingGeodata : a(
                  { attrs: { href: `geo:${geoData.position.lat},${geoData.position.lng}` } },
                  toDMS(geoData.position).format()
                )),
                td(!geoData ? loadingGeodata : String(Math.round(geoData.distanceToNumber10 / 1000)) + 'km')
              ]
            )
          })
        ]
      )
    ])
  })

  return {
    DOM: vnode$
  }
}
