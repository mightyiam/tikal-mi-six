import { DOMSource, section, h2, p, a, em, table, thead, tfoot, tbody, tr, th, td, label, input, button } from '@cycle/dom'
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

const getExtremeDistanceTo10Stream = (
  extreme: 'shortest' | 'longest',
  addressesWithData$: Stream<AddressesWithData>,
  gotAllData$: Stream<null>
): Stream<null | number> => {
  const lt = (a: number, b: number) => a < b
  const gt = (a: number, b: number) => a > b
  const operator = extreme === 'shortest' ? lt : gt

  return addressesWithData$
    .fold((extremeDistanceTo10, addressesWithData) => {
      return Object.values(addressesWithData).reduce((extreme, addressWithData) => {
        if (addressWithData === null) {
          return null
        }
        if (extreme === null) {
          return addressWithData.distanceToNumber10
        }
        const distanceToNumber10 = addressWithData.distanceToNumber10
        return operator(distanceToNumber10, extreme) ? distanceToNumber10 : extreme
      }, null as null | number)
    }, null as null | number)
    .compose(dropUntil(gotAllData$))
}

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

  const shortestDistanceTo10$ = getExtremeDistanceTo10Stream(
    'shortest',
    addressesWithData$,
    gotAllData$
  )
  const longestDistanceTo10$ = getExtremeDistanceTo10Stream(
    'longest',
    addressesWithData$,
    gotAllData$
  )

  const showExtraData$: Stream<boolean> = DOM
    .select('.show-extra')
    .events('change')
    .fold(value => !value, false)

  const deleteMissionI$: Stream<null | number> = DOM
    .select('.delete')
    .events('click')
    .map(clickEvent => (
      Number((clickEvent.currentTarget as HTMLButtonElement).dataset.i)
    ))

  const vnode$: Stream<VNode> = xs.combine(
    dateSortedMissions$,
    addressesWithData$,
    shortestDistanceTo10$,
    longestDistanceTo10$,
    showExtraData$
  ).map(([
    dateSortedMissions,
    addressesWithData,
    shortestDistanceTo10,
    longestDistanceTo10,
    showExtraData
  ]) => section(
    { class: {  section: true, content: true,'missions-table': true } },
    [
      h2('Missions table'),
      p([
        'The font in the confidential source material was identified as ',
        a(
          { attrs: { href: 'https://www.typography.com/fonts/gotham/styles/' } },
          em('Gotham Book')
        ),
        '. To the benefit of Her Majesty’s treasury, I used a free alternative, which seems to bear great resemblence.'
      ]),
      p('The following table presents the missions data, sorted by date, oldest to most recent. The missions nearest 10 Downing st., London are printed in green. The farthest, in red.'),
      p([label([
        'Show extra data: ',
        input({ attrs: { type: 'checkbox' }, class: { 'show-extra': true } })
      ])]),
      table(
        { class: { 'sisyphically-styled': true } },
        [
          thead(tr([
            th({ class: { 'delete-cell': true} }),
            th('Agent ID'),
            th('Country'),
            th('Address'),
            th({ class: { 'last': !showExtraData } }, 'Date'),
            th({ class: { 'is-hidden': !showExtraData } }, 'Coordinates'),
            th({ class: { 'is-hidden': !showExtraData } }, 'Distance to #10')
          ])),
          tfoot(tr(td(
            {
              attrs: { colspan: 7 }
            },
            String(dateSortedMissions.length) + ' missions'
          ))),
          tbody(dateSortedMissions.map(({ agent, country, address, date, i }) => {
            const geoData = addressesWithData[address]
            return tr(
              { key: i, class: {
                ['is-nearest']: geoData && geoData.distanceToNumber10 === shortestDistanceTo10,
                ['is-farthest']: geoData && geoData.distanceToNumber10 === longestDistanceTo10
              } },
              [
                td({ class: { 'delete-cell': true } }, button({ class: { delete: true }, dataset: { i: String(i) } })),
                td(agent),
                td(country),
                td(address),
                td(date),
                td(
                  { class: { 'is-hidden': !showExtraData } },
                  !geoData ? loadingGeodata : a(
                    { attrs: { href: `geo:${geoData.position.lat},${geoData.position.lng}` } },
                    toDMS(geoData.position).format()
                  )
                ),
                td(
                  { class: { 'is-hidden': !showExtraData } },
                  !geoData ? loadingGeodata : String(geoData.distanceToNumber10) + 'km'
                )
              ]
            )
          }))
        ]
      )
    ]
  ))

  return {
    DOM: vnode$,
    deleteMissionI: deleteMissionI$
  }
}
