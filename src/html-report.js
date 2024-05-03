//
// Generate HTML report from K6 summary data
// Based on work by Ben Coleman, March 2021
// Updated to be Rogers Digital West specific by Stephen Rivers
//

// Have to import ejs this way, nothing else works
import ejs from '../node_modules/ejs/ejs.min.js'
import template from './template.ejs'
import { JSONPath } from 'jsonpath-plus'

const version = '2.4.0'

class Result {
  constructor() {
    this.testSuite = ''
    this.name = ''
    this.checks = []
  }
}

//
// Main function should be imported and wrapped with the function handleSummary
//
export function htmlReport(data, opts = {}) {
  // Default options
  if (!opts.title) {
    opts.title = new Date().toLocaleDateString('en-CA')
  }
  if (!opts.reportDate) {
    opts.reportDate = new Date().toLocaleDateString('en-CA')
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

  let checkFailures = 0
  let checkPasses = 0

  let checks = []

  let results = []

  let allchecks = JSONPath({ path: '$..checks', json: data.root_group })

  for (const checks of allchecks) {
    if (checks.length != 0) {
      let result = new Result()
      let groupNames = checks[0].path.substring(2).split('::').slice(0, -1)
      result.testSuite = groupNames[0]
      result.name = checks[0].path.substring(2).split('::').slice(1, -1).join('::')

      for (const check of checks) {
        result.checks.push(check)
      }
      results.push(result)
    }
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
    reportDate: opts.reportDate,
    standardMetrics,
    otherMetrics,
    thresholdFailures,
    thresholdCount,
    checkFailures,
    checkPasses,
    version,
    checks,
    results,
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
