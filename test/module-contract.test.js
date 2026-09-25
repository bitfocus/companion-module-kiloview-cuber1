import test from 'node:test'
import assert from 'node:assert/strict'

import KiloviewR1Instance, { UpgradeScripts } from '../src/main.js'
import api from '../src/api.js'
import constants from '../src/constants.js'

// Companion reads the upgrade scripts off the module namespace object
// (`moduleImport.UpgradeScripts ?? []`), not off the default export. A CommonJS entry point
// bundles to a lone `default` export, silently yielding zero upgrade scripts.
test('entry point exposes UpgradeScripts as a named export', () => {
	assert.equal(typeof KiloviewR1Instance, 'function', 'default export must be the instance class')
	assert.ok(Array.isArray(UpgradeScripts), 'UpgradeScripts must be a named export and an array')
	assert.equal(UpgradeScripts.length, 0, 'initial release ships no upgrade scripts')
})

function makeInstance() {
	const self = { ...api }
	Object.assign(self, constants)
	self.STATE = constants.createDefaultState()
	Object.assign(self, constants.createDefaultChoiceSets())
	self.CHOICES_LAYOUTS = self.buildLayoutChoices()
	self.CHOICES_WINDOWS = self.buildWindowChoices()
	self.config = {}
	self.logs = []
	self.log = (level, message) => self.logs.push(`${level}: ${message}`)
	self.updateStatus = () => {}
	self.initActions = self.initFeedbacks = self.initVariables = self.initPresets = () => {}
	self.checkAllFeedbacks = self.checkVariables = () => {}
	self.CONNECTION_GENERATION = 1
	self.STATE_CHECK_IN_FLIGHT = false
	self.STATE_CHECK_PROMISE = null
	self.RESOURCES_CHECK_IN_FLIGHT = false
	self.POLL_ERROR_COUNT = 0
	self.SESSION_ESTABLISHED = false
	self.AUTH_RETRY_COUNT = 0
	self._destroyed = false
	return self
}

// A device that answers with a non-array where an array is documented must not reach
// rebuildChoices() with something that makes `.map()` throw: the TypeError would escape an
// un-awaited setInterval callback as an unhandled rejection (fatal under Node 22).
test('checkState survives a malformed output response', async () => {
	const self = makeInstance()
	self.DEVICE = {
		getOutput: async () => ({ result: 'ok', data: { layout_id: 'x', layout_number: null, layout: { 1: {} } } }),
		getRecordStatus: async () => ({ result: 'ok', data: 'nonsense' }),
	}

	await assert.doesNotReject(() => self.checkState())

	assert.equal(self.STATE.layout_id, null)
	assert.deepEqual(self.STATE.windows, [])
	assert.equal(self.STATE.recording, false)
})

test('checkState handles a well-formed response', async () => {
	const self = makeInstance()
	self.DEVICE = {
		getOutput: async () => ({
			result: 'ok',
			data: {
				layout_id: '2',
				layout_number: 4,
				layout: [{ id: 1, name: 'Cam 1', stream_id: 'CAM (Chan 1)', stream_name: 'CAM (Chan 1)', volume: 'on' }],
			},
		}),
		getRecordStatus: async () => ({ result: 'ok', data: { isRecording: true, startTime: '1622100648254', msg: '' } }),
	}

	await self.checkState()

	assert.equal(self.STATE.layout_id, 2)
	assert.equal(self.STATE.layout_number, 4)
	assert.equal(self.STATE.recording, true)
	assert.equal(self.STATE.record_start_time, 1622100648254)
	assert.equal(self.getWindow(1).name, 'Cam 1')
	assert.equal(self.windowHasSource(self.getWindow(1)), true)
	assert.equal(self.windowHasSource(self.getWindow(2)), false)
	assert.equal(self.CHOICES_WINDOWS[0].label, 'Window 1 (Cam 1)')
})

test('checkResources flattens discovery groups into unique source choices', async () => {
	const self = makeInstance()
	const ok = (data) => async () => ({ result: 'ok', data })
	self.DEVICE = {
		getSourceList: ok([
			{ disc_id: '1', disc_name: 'auto', sources: [{ id: 'A (1)', ip: '10.0.0.1:5961', name: 'A (1)' }] },
			{
				disc_id: '2',
				disc_name: 'manual',
				sources: [{ id: 'A (1)', ip: '10.0.0.1:5961', name: 'A (1)' }, { id: 'B' }],
			},
			'garbage',
		]),
		getLayouts: ok([
			{ id: 1, number: '1' },
			{ id: 2, number: '4' },
			{ id: 3, number: '9' },
		]),
		getStorageInfo: ok({ disk: [{ id: '0', name: 'disk1', state: 'online', rate: 12 }], choose: '0' }),
		getPerformance: ok({ cpu: 12.5 }),
		getRecordInfo: ok({ solution: 1 }),
		getHostname: ok({ hostname: 'CubeR1' }),
		getFirmware: ok({ softwareVersion: '1.0.0' }),
		getNetwork: ok([{ device: 'eth0', ip: '10.0.0.5', state: 'up' }]),
	}

	await self.checkResources()

	assert.deepEqual(
		self.STATE.sources.map((source) => source.id),
		['A (1)', 'B'],
	)
	assert.equal(self.CHOICES_SOURCES.length, 2)
	assert.equal(self.CHOICES_SOURCES[0].label, 'A (1) [auto] (10.0.0.1:5961)', 'group shown when >1 group')
	assert.equal(self.CHOICES_SOURCES[1].label, 'B [manual]')
	assert.equal(self.STATE.sources[0].disc_id, '1')
	assert.equal(self.CHOICES_DISKS[0].id, '0')
	assert.equal(self.CHOICES_LAYOUTS[1].label, '4 Split')
	assert.equal(self.STATE.hostname, 'CubeR1')
	assert.equal(self.STATE.layouts_from_device, true)
})

test('checkResources keeps going after a plain API error and stops on an unreachable device', async () => {
	const self = makeInstance()
	const ok = (data) => async () => ({ result: 'ok', data })
	const calls = []
	const unreachable = new Error('boom')
	unreachable.unreachable = true

	self.handleRequestError = async () => {
		calls.push('handled')
	}
	self.DEVICE = {
		getSourceList: async () => {
			calls.push('sources')
			throw new Error('Device rejected the request')
		},
		getLayouts: async () => {
			calls.push('layouts')
			throw unreachable
		},
		getStorageInfo: async () => {
			calls.push('storage')
			return { result: 'ok', data: {} }
		},
		getPerformance: ok({}),
		getRecordInfo: ok({}),
		getHostname: ok({}),
		getFirmware: ok({}),
		getNetwork: ok([]),
	}

	await self.checkResources()

	assert.deepEqual(calls, ['sources', 'layouts', 'handled'])
	assert.equal(self.RESOURCES_CHECK_IN_FLIGHT, false)
})

test('concurrent checkState calls do not overlap, and the in-flight promise is awaitable', async () => {
	const self = makeInstance()
	let getOutputCalls = 0
	self.DEVICE = {
		getOutput: async () => {
			getOutputCalls++
			await new Promise((r) => setTimeout(r, 40))
			return { result: 'ok', data: { layout_id: 1, layout_number: 1, layout: [] } }
		},
		getRecordStatus: async () => ({ result: 'ok', data: { isRecording: false } }),
	}

	const first = self.checkState()
	await self.checkState() // must be dropped while the first is running
	assert.equal(getOutputCalls, 1)

	assert.ok(self.STATE_CHECK_PROMISE, 'in-flight check must be published for refreshStateAfterAction')
	await first
	assert.equal(self.STATE_CHECK_PROMISE, null, 'in-flight promise must be cleared once settled')
})

// The reconnect timer must be armed before the dispose completes. We only reach
// handleConnectionFailure because the device is unreachable, so logout() inside dispose runs to
// its full request timeout; awaiting it first would delay the first retry by that much.
test('handleConnectionFailure arms the reconnect before waiting on dispose', async () => {
	const self = makeInstance()
	self.config.host = '10.0.0.1'
	self.RECONNECT_TIME = 30000

	const order = []
	self.stopIntervals = () => {}
	self.startReconnectInterval = () => order.push('reconnect-armed')

	let releaseLogout
	const logoutBlocked = new Promise((resolve) => (releaseLogout = resolve))
	self.DEVICE = {
		// stands in for a logout that hangs until its request timeout on a dead device
		logout: () => logoutBlocked.then(() => order.push('logout-finished')),
		close: () => order.push('closed'),
	}

	const pending = self.handleConnectionFailure(new Error('unreachable'), 'Poll failed')

	await new Promise((r) => setImmediate(r))
	assert.deepEqual(order, ['reconnect-armed'], 'retry must be armed while dispose is still open')

	releaseLogout()
	await pending
	assert.deepEqual(order, ['reconnect-armed', 'logout-finished', 'closed'])
	assert.equal(self.DEVICE, null, 'device reference must be cleared')
})

// The logout inside disposeDevice() is only a courtesy; on a dead device it must not hold the
// close (and therefore destroy()) for the full request timeout.
test('disposeDevice caps the logout and still closes the client', async () => {
	const self = makeInstance()
	self.LOGOUT_TIMEOUT = 20

	const order = []
	const device = {
		logout: () => new Promise(() => order.push('logout-started')), // never settles
		close: () => order.push('closed'),
	}

	const started = Date.now()
	await self.disposeDevice(device)

	assert.deepEqual(order, ['logout-started', 'closed'])
	assert.ok(Date.now() - started < 1000, 'must not wait for the hung logout')
})
