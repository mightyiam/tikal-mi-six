import xs, { Stream } from 'xstream'
import flattenConcurrently from 'xstream/extra/flattenConcurrently'
import { VNode, DOMSource, body, section, h1, h2, ul, li, pre, code, p, span, img, a } from '@cycle/dom'
import { HTTPSource, RequestOptions, Response } from '@cycle/http'
import { InputMission, Mission, LatLng, AddressesWithData, AddressWithData } from './interfaces'
import * as stringify from 'stringify-object'
import Isolation from './isolation'
import MissionsTable from './missions-table'
import dateFormat from './date-format'
import * as moment from 'moment'
import getDistanceToNumber10 from './distance-to-number-10'
import pick = require('lodash.pick')

import './spa.scss'

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
  missions: Stream<InputMission[]>
}

export default ({ DOM, HTTP, missions: inputMissions$ }: Sources) => {
  const correctedMissions$: Stream<Mission[]> = inputMissions$.map((missions) => (
    missions.map((mission, i) => {
      let correctedDate: string | undefined = undefined
      for (let i: number = 0; correctedDate === undefined; i ++) {
        const dateFromI: string = mission.date.slice(i)
        correctedDate = moment(dateFromI, dateFormat, true).isValid() ? dateFromI : undefined
      }
      return Object.assign({}, mission, { date: correctedDate, i })
    })
  ))

  const deleteMissionIProxy$: Stream<null | number> = xs.create() as Stream<null | number>
  const missions$: Stream<Mission[]> = xs
    .combine(correctedMissions$, deleteMissionIProxy$.startWith(null))
    .fold((missions, [correctedMissions, deleteMissionI]) => {
      if (missions === null) {
        return correctedMissions
      }
      if (deleteMissionI === null) {
        return correctedMissions
      }
      return missions
        .filter(mission => mission.i !== deleteMissionI)
    }, [] as Mission[])

  const missionAddress$: Stream<string> = missions$
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

  const retrievedAddressesWithData$: Stream<AddressesWithData> = positionResponse$
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

  const addressesWithData$: Stream<AddressesWithData> = xs
    .combine(retrievedAddressesWithData$, missions$)
    .map(([ retrievedAddressesWithData, missions ]) => (
      pick(retrievedAddressesWithData, missions.map(mission => mission.address)) as AddressesWithData
    ))

  const { DOM: isolationVnode$ }: { DOM: Stream<VNode> } = Isolation({
    DOM,
    missions: missions$
  })

  const {
    DOM: missionsTableVnode$,
    deleteMissionI: deleteMissionI$
  } = MissionsTable({
    DOM,
    missions: missions$,
    addressesWithData: addressesWithData$
  })

  deleteMissionIProxy$.imitate(deleteMissionI$)

  const vnode$: Stream<VNode> = xs.combine(
    inputMissions$,
    isolationVnode$,
    missionsTableVnode$
  ).map(([
    inputMissions,
    isolationVnode,
    missionsTableVnode
  ]) => body(
    {
      props: {
        id: '' // workaround for https://github.com/cyclejs/cyclejs/issues/540

      }
    },
    [
      section({ class: { section: true, content: true } }, [
        h1('MI6 missions report'),
        h2('Meta'),
        ul([
          li(['agent: ', span({ class: { confidential: true } }, 'Shahar Or')]),
          li('classification: restricted'),
          li('on request of: Tikal'),
          li('agent status: unknown'),
          li(a(
            { attrs: { href: 'https://travis-ci.org/mightyiam/tikal-mi-six' } },
            img({ attrs: { alt: 'build status' , src: 'https://travis-ci.org/mightyiam/tikal-mi-six.svg?branch=master' } })
          ))
        ]),
        h2('Raw missions data'),
        p('The missions data contains corrupted parts. From my experience in the field, it appears to be a result of a sabotage. Likely that field agent who went rogue in \'98.'),
        p('As you can see below, the corruptions are in some of the dates. They were not manually altered—they were handled in the code.'),
        pre(code(stringify(inputMissions, { indent: '  ' })))
      ]),
      isolationVnode,
      missionsTableVnode
    ]
  ))

  return {
    DOM: vnode$,
    HTTP: positionRequest$
  }
}
