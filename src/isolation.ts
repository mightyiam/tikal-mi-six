import xs, { Stream } from 'xstream'
import { Mission } from './interfaces'
import { DOMSource, section, table, tr, th, td, h2, h3, p, strong } from '@cycle/dom'
import { VNode } from 'snabbdom/vnode'

const isolatedBGColor: string = 'rgba(0, 0, 0, 0.382)'

const analyze: (missions: Mission[]) => Analysis = (missions) => {
  return missions.reduce(({ agents, countries }: Analysis, { country: countryName, agent: agentId }) => {
    if (!agents[agentId]) {
      agents[agentId] = {
        id: agentId,
        nMissions: 0
      }
    }
    const agent: AgentAnalysis = agents[agentId]

    agent.nMissions ++

    if (!countries[countryName]) {
      countries[countryName] = {
        name: countryName,
        nMissions: 0,
        agents: new Set(),
        nIsolatedAgents: 0,
        nNonIsolatedAgents: 0
      }
    }
    const country: CountryAnalysis = countries[countryName]

    country.nMissions ++
    country.agents.add(agent)
    country.nIsolatedAgents = [...country.agents].reduce((n, a) => n + (a.nMissions === 1 ? 1 : 0), 0)
    country.nNonIsolatedAgents = country.agents.size - country.nIsolatedAgents

    return { agents, countries }

  }, { agents: {}, countries: {} })
}

interface CountryAnalysis {
  name: string
  nMissions: number
  agents: Set<AgentAnalysis>
  nIsolatedAgents: number
  nNonIsolatedAgents: number
}

interface AgentAnalysis {
  id: string
  nMissions: number
}

interface CountriesAnalysis {
  [name: string]: CountryAnalysis
}

interface AgentsAnalysis {
  [agentId: string]: AgentAnalysis
}

interface Analysis {
  countries: CountriesAnalysis
  agents: AgentsAnalysis
}

interface Sources {
  DOM: DOMSource
  missions: Stream<Mission[]>
}

export default ({ DOM, missions: missions$ }: Sources) => {
  const analysis$: Stream<Analysis> = missions$.map(analyze)

  const highestIsolationDegree$: Stream<number> = analysis$.map(({ countries }) => (
    Object.values(countries)
      .map(country => country.nIsolatedAgents)
      .reduce((acc, cur) => cur > acc ? cur : acc, 0)
  ))

  const vnode$: Stream<VNode> = xs.combine(
    missions$,
    analysis$,
    highestIsolationDegree$
  ).map(([
    missions,
    { agents, countries },
    highestIsolationDegree
  ]) => section(
    [
      h2('Isolation'),
      h3('Missions'),
      table([
        tr([
          th('agent'),
          th('country')
        ]),
        ...missions.map(({ agent, country }) => (
          tr(
            [
              td(agent),
              td(country)
            ]
          )
        ))
      ]),
      h3('Agents'),
      p('In the following table, the isolated agents are marked.'),
      table([
        tr([
          th('agent'),
          th(['# missions'])
        ]),
        ...Object.values(agents).map(({ id, nMissions }) => {
          const isIsolated: boolean = nMissions === 1
          return tr(
            { style: { 'background-color': isIsolated ? isolatedBGColor : 'unset' } },
            [
              td(id),
              td(isIsolated ? strong(String(nMissions)) : String(nMissions))
            ]
          )
        })
      ]),
      h3('Countries'),
      p('In the following table, the countries with the highest isolation degree are marked.'),
      table([
        tr([
          th('country'),
          th(['# missions']),
          th('agents'),
          th(['# agents']),
          th(['# isolated agents']),
          th(['# non-isolated agents'])
        ]),
        ...Object.values(countries).map(({ name, nMissions, agents: countryAgents, nIsolatedAgents, nNonIsolatedAgents }) => {
          const hasHighestIsolation: boolean = nIsolatedAgents === highestIsolationDegree
          return tr(
            {
              style: { 'background-color': hasHighestIsolation ? isolatedBGColor : 'unset' }
            },
            [
              td(name),
              td(String(nMissions)),
              td([...countryAgents].map(agent => agent.id).join(', ')),
              td(String(countryAgents.size)),
              td(hasHighestIsolation ? strong(String(nIsolatedAgents)) : String(nIsolatedAgents)),
              td(String(nNonIsolatedAgents))
            ]
          )
        })
      ])
    ])
  )

  return {
    DOM: vnode$
  }
}
