import { run } from '@cycle/run'
import { makeDOMDriver } from '@cycle/dom'
import { makeHTTPDriver } from '@cycle/http'
import xs from 'xstream'

import sampleMissions from './sample-missions'
import Spa from './spa'

run(Spa, {
  DOM: makeDOMDriver('body'),
  HTTP: makeHTTPDriver(),
  missions: () => xs.of(sampleMissions)
})
