//
// Generate HTML report from K6 summary data
// Ben Coleman, March 2021
//

// Have to import ejs this way, nothing else works
import ejs from '../node_modules/ejs/ejs.min.js'
import template from './template.ejs'

const version = '2.4.0'

class Group {
  constructor() {
    this.name = ''
    this.passes = 0
    this.fails = 0
    this.id = ''
    this.hasChecks = false
    this.groups = []
  }
}
//
// Main function should be imported and wrapped with the function handleSummary
//
export function htmlReport(data, opts = {}) {
  // Default options
  if (!opts.title) {
    opts.title = new Date().toISOString().slice(0, 16).replace('T', ' ')
  }
  // eslint-disable-next-line
  if (!opts.hasOwnProperty('debug')) {
    opts.debug = false
  }

  console.log(`[k6-reporter v${version}] Generating HTML summary report`)
  let metricListSorted = []

  if (opts.debug) {
    console.log(JSON.stringify(data, null, 2))
  }

  // Count the thresholds and those that have failed
  let thresholdFailures = 0
  let thresholdCount = 0
  for (let metricName in data.metrics) {
    metricListSorted.push(metricName)
    if (data.metrics[metricName].thresholds) {
      thresholdCount++
      let thresholds = data.metrics[metricName].thresholds
      for (let thresName in thresholds) {
        if (!thresholds[thresName].ok) {
          thresholdFailures++
        }
      }
    }
  }

  // Count the checks and those that have passed or failed
  // NOTE. Nested groups are not checked!
  let checkFailures = 0
  let checkPasses = 0
  // if (data.root_group.checks) {
  //   let { passes, fails } = countChecks(data.root_group.checks)
  //   checkFailures += fails
  //   checkPasses += passes
  // }

  // for (let group of data.root_group.groups) {
  //   if (group.checks) {
  //     let { passes, fails } = countChecks(group.checks)
  //     checkFailures += fails
  //     checkPasses += passes
  //   }
  // }

  let checks = []
  for (const group of data.root_group.groups) {
    checks = checks.concat(getChecks(group))
  }
  let groups = []
  for (const group of data.root_group.groups) {
    groups = checks.concat(getGroups(group))
  }
  for (const group of groups) {
    console.log(group)
  }
  let { passes, fails } = countChecks(checks)

  checkFailures += fails
  checkPasses += passes

  const standardMetrics = [
    'grpc_req_duration',
    'http_req_duration',
    'http_req_waiting',
    'http_req_connecting',
    'http_req_tls_handshaking',
    'http_req_sending',
    'http_req_receiving',
    'http_req_blocked',
    'iteration_duration',
    'group_duration',
    'ws_connecting',
    'ws_msgs_received',
    'ws_msgs_sent',
    'ws_sessions',
  ]

  const otherMetrics = [
    'iterations',
    'data_sent',
    'checks',
    'http_reqs',
    'data_received',
    'vus_max',
    'vus',
    'http_req_failed',
    'http_req_duration{expected_response:true}',
  ]

  // Render the template
  const html = ejs.render(template, {
    data,
    title: opts.title,
    standardMetrics,
    otherMetrics,
    thresholdFailures,
    thresholdCount,
    checkFailures,
    checkPasses,
    version,
    checks,
    groups,
  })

  // Return HTML string needs wrapping in a handleSummary result object
  // See https://k6.io/docs/results-visualization/end-of-test-summary#handlesummary-callback
  return html
}

//
// Helper for counting the checks in a group
//
function countChecks(checks) {
  let passes = 0
  let fails = 0
  for (let check of checks) {
    passes += parseInt(check.passes)
    fails += parseInt(check.fails)
  }
  return { passes, fails }
}

function getGroups(data) {
  let groups = []
  if (data.checks.length == 0) {
    for (const group of data.groups) {
      const newGroup = new Group()
      newGroup.name = group.name
      newGroup.id = group.id
      newGroup.groups = getGroups(group)
    }
  } else {
    for (const check of data.checks) {
      const newGroup = new Group()
      newGroup.name = check.name
      newGroup.passes = check.passes
      newGroup.fails = check.fails
      groups.push(newGroup)
    }
  }
  return groups
}

function getChecks(data) {
  let checks = []
  if (data.checks.length != 0) {
    for (const check of data.checks) {
      const newGroup = new Group()
      newGroup.name = check.name
      newGroup.passes = check.passes
      newGroup.fails = check.fails
      const newCheck = {
        passes: check.passes,
        fails: check.fails,
        name: check.name,
        path: check.path,
        id: check.id,
        paths: parsePath(check.path),
      }
      checks.push(newCheck)
    }
  } else {
    for (const group of data.groups) {
      checks = checks.concat(getChecks(group))
    }
  }
  return checks
}

function parsePath(data) {
  return data.substring(2).split('::')
}
