import xs, { Stream } from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import { VNode, DOMSource, body, h1, h2, dl, dt, dd, pre, code, p } from '@cycle/dom'
import { HTTPSource, RequestOptions, Response } from '@cycle/http'
import { Mission, LatLng, AddressesWithData, AddressWithData } from './interfaces'
import * as stringify from 'stringify-object'
import Isolation from './isolation'
import MissionsTable from './missions-table'
import dateFormat from './date-format'
import * as moment from 'moment'
import getDistanceToNumber10 from './distance-to-number-10'

const MISSION_POSITION = 'mission position'

interface PositionQuery {
  address: string
  key: string
}

interface PositionRequestOptions extends RequestOptions {
  query: PositionQuery
}

interface PositionResponse extends Response {
  body: {
    status: string
    results: PositionResult[]
  }
  request: PositionRequestOptions
}

interface PositionResult {
  geometry: {
    location: LatLng
  }
}

interface Sources {
  DOM: DOMSource
  HTTP: HTTPSource
  missions: Stream<Mission[]>
}

export default ({ DOM, HTTP, missions: missions$ }: Sources) => {
  const correctedMissions$: Stream<Mission[]> = missions$.map((missions) => (
    missions.map(mission => {
      let correctedDate: string | undefined = undefined
      for (let i: number = 0; correctedDate === undefined; i ++) {
        const dateFromI: string = mission.date.slice(i)
        correctedDate = moment(dateFromI, dateFormat, true).isValid() ? dateFromI : undefined
      }
      return Object.assign({}, mission, { date: correctedDate })
    })
  ))

  const missionAddress$: Stream<string> = correctedMissions$
    .map((missions) => (
      xs.from(missions.map(mission => mission.address))
    ))
    .flatten()

  const positionRequest$: Stream<PositionRequestOptions> = missionAddress$
    .map((address) => ({
      category: MISSION_POSITION,
      url: 'https://maps.googleapis.com/maps/api/geocode/json',
      query: {
        address,
        key: 'AIzaSyBzwgyKn422kxD3wOi4eCVHQ9K78yd_k9Q'
      }
    }))

  const positionResponse$: Stream<PositionResponse> = HTTP
    .select(MISSION_POSITION)
    .compose(flattenConcurrently)
    .filter(response => response.status === 200)
    .map(response => response as PositionResponse)

  const addressesWithData$: Stream<AddressesWithData> = positionResponse$
    .fold((addressesWithData, { body, request: { query: { address } } }) => {
      if (addressesWithData[address]) {
        return addressesWithData
      }
      const position = body.results[0].geometry.location
      const distanceToNumber10 = getDistanceToNumber10(position)
      const addressWithData: AddressWithData = { address, position, distanceToNumber10 }
      addressesWithData[address] = addressWithData
      return addressesWithData
    }, {} as AddressesWithData)

  const { DOM: isolationVnode$ }: { DOM: Stream<VNode> } = Isolation({
    DOM,
    missions: correctedMissions$
  })

  const { DOM: missionsTableVnode$ }: { DOM: Stream<VNode> } = MissionsTable({
    DOM,
    missions: correctedMissions$,
    // nearestAddress: xs.of('atlas marina beach, agadir'),
    // farthestAddress: xs.of('27 Derb Lferrane, Marrakech')
    addressesWithData: addressesWithData$
  })

  const vnode$: Stream<VNode> = xs.combine(
    missions$,
    isolationVnode$,
    missionsTableVnode$
  ).map(([
    missions,
    isolationVnode,
    missionsTableVnode
  ]) => (
    body(
      {
        props: {
          id: '' // workaround for https://github.com/cyclejs/cyclejs/issues/540
        }
      },
      [
        h1('MI6 missions report'),
        dl([
          dt('agent'),
          dd(
            { class: { confidential: true } },
            'Shahar Or'
          ),
          dt('classification'),
          dd('restricted'),
          dt('on request of'),
          dd('Tikal'),
          dt('agent status'),
          dd('unknown')
        ]),
        h2('Raw missions data'),
        p('The missions data contains corrupted parts. From my experience in the field, it appears to be a result of a sabotage. Likely that field agent who went rogue in \'98.'),
        p('As you can see below, the corruptions are in some of the dates. They were not manually altered—they were handled in the code.'),
        pre(code(stringify(missions, { indent: '  ' }))),
        h2('Isolation'),
        isolationVnode,
        h2('Missions table'),
        missionsTableVnode
      ]
    )
  ))

  return {
    DOM: vnode$,
    HTTP: positionRequest$
  }
}
