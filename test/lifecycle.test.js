import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import api from '../src/api.js'
import constants from '../src/constants.js'
import actions from '../src/actions.js'
import feedbacks from '../src/feedbacks.js'
import variables from '../src/variables.js'
import presets from '../src/presets.js'

// A minimal stand-in for InstanceBase: enough of the surface for api/actions/feedbacks/
// variables/presets to run unchanged against a real HTTP client and a fake device.
function makeInstance(port) {
	const self = { ...api, ...actions, ...feedbacks, ...variables, ...presets }
	Object.assign(self, constants)
	self.STATE = constants.createDefaultState()
	Object.assign(self, constants.createDefaultChoiceSets())
	self.CHOICES_LAYOUTS = self.buildLayoutChoices()
	self.CHOICES_WINDOWS = self.buildWindowChoices()

	self.config = {
		host: '127.0.0.1',
		protocol: 'http',
		port,
		username: 'admin',
		polling: false,
		request_timeout: 1000,
	}
	self.secrets = { password: 'admin' }
	self.getPassword = () => self.secrets.password

	self.logs = []
	self.log = (level, message) => self.logs.push(`${level}: ${message}`)
	self.statuses = []
	self.updateStatus = (status, message) => self.statuses.push(message ? `${status}: ${message}` : status)

	self.actionDefinitions = {}
	self.feedbackDefinitions = {}
	self.variableDefinitions = {}
	self.variableValues = {}
	self.presetStructure = []
	self.presetDefinitions = {}
	self.setActionDefinitions = (defs) => (self.actionDefinitions = defs)
	self.setFeedbackDefinitions = (defs) => (self.feedbackDefinitions = defs)
	self.setVariableDefinitions = (defs) => (self.variableDefinitions = defs)
	self.setVariableValues = (values) => Object.assign(self.variableValues, values)
	self.setPresetDefinitions = (structure, defs) => {
		self.presetStructure = structure
		self.presetDefinitions = defs
	}
	self.checkAllFeedbacks = () => {}

	self.DEVICE = undefined
	self.INTERVAL = null
	self.INTERVAL_RESOURCES = null
	self.RECONNECT_INTERVAL = null
	self.STATE_CHECK_IN_FLIGHT = false
	self.STATE_CHECK_PROMISE = null
	self.RESOURCES_CHECK_IN_FLIGHT = false
	self.CONNECTION_GENERATION = 0
	self.INIT_CONNECTION_PROMISE = null
	self.POLL_ERROR_COUNT = 0
	self.SESSION_ESTABLISHED = false
	self.AUTH_RETRY_COUNT = 0
	self._destroyed = false

	return self
}

function makeDevice() {
	const state = {
		recording: false,
		layout_id: 2,
		layout_number: 4,
		windows: [
			{
				id: 1,
				name: 'Cam 1',
				stream_id: 'CAM (Chan 1)',
				stream_name: 'CAM (Chan 1)',
				bit_rate: 4096000,
				ntp_state: 'sync',
				showAll: true,
				showVolume: true,
				showVideo: true,
				volume: 'on',
			},
			{
				id: 2,
				name: 'Cam 2',
				stream_id: '',
				stream_name: '',
				showAll: true,
				showVolume: true,
				showVideo: true,
				volume: 'off',
			},
		],
		record_info: { solution: 0, sync: true, isStart: false, startTime: '', isStop: false, stopTime: '' },
	}

	const requests = []
	const routes = {
		'/api/r1/users/login.json': (req) =>
			!state.rejectLogins && req.body?.username === 'admin' && req.body?.password === 'admin'
				? { result: 'ok', data: { token: 'tok', username: 'admin' } }
				: { result: 'error', msg: 'Username or password is incorrect' },
		'/api/r1/users/logout.json': () => ({ result: 'ok' }),
		'/api/r1/source/list.json': () => ({
			result: 'ok',
			data: [
				{
					disc_id: '1',
					disc_name: 'auto-discovery',
					sources: [
						{ id: 'CAM (Chan 1)', ip: '10.0.0.10:5961', name: 'CAM (Chan 1)' },
						{ id: 'CAM (Chan 2)', ip: '10.0.0.11:5961', name: 'CAM (Chan 2)' },
					],
				},
			],
		}),
		'/api/r1/layout/icon.json': () => ({
			result: 'ok',
			data: [
				{ id: 1, number: '1' },
				{ id: 2, number: '4' },
				{ id: 3, number: '9' },
			],
		}),
		'/api/r1/storage/getStoInfo.json': () => ({
			result: 'ok',
			data: {
				disk: [
					{
						name: 'disk1',
						id: '0',
						unlock: true,
						state: 'online',
						total: '900G',
						used: '30M',
						rate: 1,
						speed: 0,
						recoding: state.recording,
						msg: '',
					},
					{
						name: 'disk2',
						id: '1',
						unlock: false,
						state: 'offline',
						total: '',
						used: '',
						rate: 0,
						speed: 0,
						recoding: false,
						msg: '',
					},
				],
				choose: state.chooseAsNumber ? 0 : '0',
				limitType: 'size',
				limitSize: 10,
				limitTime: 60,
			},
		}),
		'/api/r1/performance/getSys.json': () => ({
			result: 'ok',
			data: { cpu: 45.4, gpu: 12, temp: 61, mem_use: 2560, mem_total: 8192, net_up: 1024, net_down: 128 },
		}),
		'/api/r1/record/getinfo.json': () => ({ result: 'ok', data: state.record_info }),
		'/api/r1/record/setinfo.json': (req) => {
			state.record_info = req.body
			return { result: 'ok' }
		},
		'/api/r1/system/getHostname.json': () => ({ result: 'ok', data: { hostname: 'CubeR1' } }),
		'/api/r1/firmware/get.json': () => ({ result: 'ok', data: { softwareVersion: '1.2.3', firmwareVersion: '1.0.0' } }),
		'/api/r1/network/getNet.json': () => ({
			result: 'ok',
			data: [
				{ device: 'ofp0', ip: '0.0.0.0', state: 'down' },
				{ device: 'eth0', ip: '10.0.0.5', state: 'up' },
			],
		}),
		'/api/r1/output/get.json?project_id=1': () => ({
			result: 'ok',
			data: { layout_id: String(state.layout_id), layout_number: state.layout_number, layout: state.windows },
		}),
		'/api/r1/record/getRecStatus.json?project_id=1': () => ({
			result: 'ok',
			data: { isRecording: state.recording, startTime: state.recording ? Date.now() - 65000 : 0, msg: '' },
		}),
		'/api/r1/storage/setStoLimit.json': () => ({ result: 'ok' }),
		'/api/r1/record/setRecStatus.json': (req) => {
			state.recording = req.body.isRecording === true
			return { result: 'ok' }
		},
		'/api/r1/layout/setLayout.json': (req) => {
			state.layout_id = req.body.layout_id
			state.layout_number = req.body.layout_number
			return { result: 'ok' }
		},
		'/api/r1/output/setSource.json': (req) => {
			const window = state.windows.find((w) => w.id === req.body.position)
			window.stream_id = req.body.stream_id
			window.stream_name = req.body.stream_id
			return { result: 'ok' }
		},
		'/api/r1/output/window_audio_set.json': (req) => {
			state.windows.find((w) => w.id === req.body.position).volume = req.body.volume
			return { result: 'ok' }
		},
		'/api/r1/output/setEnable.json': (req) => {
			const window = state.windows.find((w) => w.id === req.body.position)
			Object.assign(window, {
				showAll: req.body.showAll,
				showVolume: req.body.showVolume,
				showVideo: req.body.showVideo,
			})
			return { result: 'ok' }
		},
	}

	const server = http.createServer((req, res) => {
		let body = ''
		req.on('data', (chunk) => (body += chunk))
		req.on('end', () => {
			const entry = { method: req.method, url: req.url, body: body ? JSON.parse(body) : undefined }
			requests.push(entry)
			const route = routes[req.url]
			res.setHeader('Content-Type', 'application/json')
			if (!route) {
				res.statusCode = 404
				res.end(JSON.stringify({ result: 'error', msg: `no route for ${req.url}` }))
				return
			}
			if (req.url !== '/api/r1/users/login.json' && !req.headers.app) {
				res.end(JSON.stringify({ result: 'error', msg: 'Token_Error' }))
				return
			}
			res.end(JSON.stringify(route(entry)))
		})
	})

	return { server, state, requests }
}

async function withInstance(fn) {
	const device = makeDevice()
	await new Promise((resolve) => device.server.listen(0, '127.0.0.1', resolve))
	const self = makeInstance(device.server.address().port)

	try {
		await fn(self, device)
	} finally {
		self._destroyed = true
		self.CONNECTION_GENERATION++
		self.stopIntervals()
		await self.INIT_CONNECTION_PROMISE
		await self.disposeDevice(self.DEVICE)
		await new Promise((resolve) => device.server.close(resolve))
	}
}

const runAction = (self, actionId, options) => self.actionDefinitions[actionId].callback({ options })
const runFeedback = (self, feedbackId, options) => self.feedbackDefinitions[feedbackId].callback({ options })

test('initConnection logs in, loads resources and state, and publishes choices/variables', async () => {
	await withInstance(async (self, device) => {
		await self.initConnection()

		assert.ok(self.DEVICE, 'device client must be kept')
		assert.equal(self.statuses.at(-1), 'ok')
		assert.equal(self.STATE.layout_id, 2)
		assert.equal(self.STATE.layouts_from_device, true)
		assert.equal(self.STATE.sources.length, 2)
		assert.equal(self.STATE.hostname, 'CubeR1')

		assert.deepEqual(
			self.CHOICES_SOURCES.map((c) => c.id),
			['CAM (Chan 1)', 'CAM (Chan 2)'],
		)
		assert.deepEqual(
			self.CHOICES_DISKS.map((c) => c.label),
			['disk1', 'disk2'],
		)
		assert.equal(self.CHOICES_WINDOWS[0].label, 'Window 1 (Cam 1)')
		assert.equal(self.CHOICES_SOURCES[0].label, 'CAM (Chan 1) (10.0.0.10:5961)', 'no group suffix with one group')
		assert.equal(self.CHOICES_WINDOWS.length, 9)

		assert.equal(self.variableValues.hostname, 'CubeR1')
		assert.equal(self.variableValues.ip_address, '10.0.0.5')
		assert.equal(self.variableValues.cpu, '45%')
		assert.equal(self.variableValues.memory, '31%')
		assert.equal(self.variableValues.temperature_f, '142°F')
		assert.equal(self.variableValues.window_1_source, 'CAM (Chan 1)')
		assert.equal(self.variableValues.window_1_source_ip, '10.0.0.10:5961')
		assert.equal(self.variableValues.window_1_bitrate, '4.1 Mbps')
		assert.equal(self.variableValues.window_2_source, '')
		assert.equal(self.variableValues.window_2_audio, 'False')
		assert.equal(self.variableValues.window_3_audio, '', 'a window the device did not report has no audio state')
		assert.equal(runFeedback(self, 'windowMuted', { window: 2 }), true)
		assert.equal(runFeedback(self, 'windowMuted', { window: 3 }), false)
		assert.equal(self.variableValues.disk_1_total, '900G')
		assert.equal(self.variableValues.disk_2_state, 'offline')
		assert.equal(self.variableValues.recording, 'False')
		assert.equal(self.variableValues.transcoding, 'Native (same as source)')

		// every variable that has a definition got a value, and vice versa
		assert.deepEqual(Object.keys(self.variableValues).sort(), Object.keys(self.variableDefinitions).sort())

		// every preset is reachable from the structure, and references only known actions/feedbacks
		const referenced = new Set()
		const walk = (definitions) => {
			for (const entry of definitions) {
				if (typeof entry === 'string') {
					referenced.add(entry)
				} else {
					walk(entry.presets ?? entry.definitions ?? [])
				}
			}
		}
		walk(self.presetStructure.map((section) => ({ definitions: section.definitions })))
		assert.deepEqual([...referenced].sort(), Object.keys(self.presetDefinitions).sort())
		for (const preset of Object.values(self.presetDefinitions)) {
			for (const step of preset.steps) {
				for (const action of [...step.down, ...step.up]) {
					assert.ok(self.actionDefinitions[action.actionId], `preset uses unknown action ${action.actionId}`)
				}
			}
			for (const feedback of preset.feedbacks) {
				assert.ok(self.feedbackDefinitions[feedback.feedbackId], `preset uses unknown feedback ${feedback.feedbackId}`)
			}
		}

		assert.equal(device.requests[0].url, '/api/r1/users/login.json')
	})
})

test('actions send the right requests and the follow-up poll updates feedbacks', async () => {
	await withInstance(async (self, device) => {
		await self.initConnection()

		assert.equal(runFeedback(self, 'recordingActive', {}), false)
		await runAction(self, 'setRecording', { mode: 'toggle' })
		assert.equal(device.state.recording, true)
		assert.equal(runFeedback(self, 'recordingActive', {}), true)
		assert.match(self.variableValues.recording_duration, /^00:01:0\d$/)

		await runAction(self, 'setRecording', { mode: 'toggle' })
		assert.equal(device.state.recording, false)

		await runAction(self, 'setLayout', { layout: 3 })
		const setLayout = device.requests.find((r) => r.url === '/api/r1/layout/setLayout.json')
		assert.deepEqual(setLayout.body, { project_id: 1, layout_id: 3, layout_number: 9 })
		assert.equal(runFeedback(self, 'layoutActive', { layout: 3 }), true)
		assert.equal(runFeedback(self, 'layoutActive', { layout: 2 }), false)

		assert.equal(runFeedback(self, 'windowEmpty', { window: 2 }), true)
		await runAction(self, 'setWindowSource', { window: 2, source: 'CAM (Chan 2)' })
		const setSource = device.requests.find((r) => r.url === '/api/r1/output/setSource.json')
		assert.deepEqual(setSource.body, {
			project_id: 1,
			position: 2,
			stream_id: 'CAM (Chan 2)',
			type: 'source',
			ip: '10.0.0.11:5961',
			disc_id: '1',
			disc_name: 'auto-discovery',
		})
		assert.equal(runFeedback(self, 'windowSource', { window: 2, source: 'CAM (Chan 2)' }), true)
		assert.equal(runFeedback(self, 'windowSource', { window: 2, source: 'any' }), true)
		assert.equal(runFeedback(self, 'windowEmpty', { window: 2 }), false)

		assert.equal(runFeedback(self, 'windowMuted', { window: 1 }), false)
		await runAction(self, 'setWindowMute', { window: 1, mode: 'toggle' })
		assert.equal(device.state.windows[0].volume, 'off')
		assert.equal(runFeedback(self, 'windowMuted', { window: 1 }), true)

		await runAction(self, 'setWindowDisplay', { window: 1, target: 'video', mode: 'hide' })
		const setEnable = device.requests.find((r) => r.url === '/api/r1/output/setEnable.json')
		assert.deepEqual(setEnable.body, { project_id: 1, position: 1, showAll: false, showVolume: true, showVideo: false })
		assert.equal(runFeedback(self, 'windowDisplay', { window: 1, target: 'video', state: 'hidden' }), true)

		await runAction(self, 'setTranscoding', { solution: 2 })
		assert.equal(device.state.record_info.solution, 2)
		assert.equal(device.state.record_info.sync, true, 'untouched settings must be preserved')
		assert.equal(runFeedback(self, 'transcodingActive', { solution: 2 }), true)

		// a placeholder choice never reaches the device
		const before = device.requests.length
		self.CHOICES_SOURCES = [{ ...constants.PLACEHOLDER_SOURCE }]
		await runAction(self, 'setWindowSource', { window: 1, source: 0 })
		assert.equal(device.requests.length, before)
		assert.ok(self.logs.some((line) => /no valid source selected/.test(line)))
	})
})

test('a bad password ends in AuthenticationFailure without a reconnect timer', async () => {
	await withInstance(async (self) => {
		self.secrets.password = 'wrong'
		await self.initConnection()

		assert.equal(self.DEVICE, null)
		assert.equal(self.RECONNECT_INTERVAL, null)
		assert.match(self.statuses.at(-1), /^authentication_failure/)
	})
})

test('an unreachable device ends in ConnectionFailure with a reconnect timer armed', async () => {
	const self = makeInstance(1)
	try {
		await self.initConnection()

		assert.equal(self.DEVICE, null)
		assert.ok(self.RECONNECT_INTERVAL, 'reconnect must be scheduled')
		assert.match(self.statuses.at(-1), /^connection_failure/)
	} finally {
		self._destroyed = true
		self.stopIntervals()
	}
})

test('switching layout regenerates the per-window presets even though the window dropdown is unchanged', async () => {
	await withInstance(async (self) => {
		await self.initConnection()

		const sourceGroups = () => self.presetStructure.find((section) => section.id === 'window_sources').definitions
		assert.equal(sourceGroups().length, 4, 'presets cover the windows of the current 4-split layout')

		const windowChoicesBefore = JSON.stringify(self.CHOICES_WINDOWS)
		await runAction(self, 'setLayout', { layout: 3 })

		assert.equal(JSON.stringify(self.CHOICES_WINDOWS), windowChoicesBefore, 'the dropdown itself must not change')
		assert.equal(sourceGroups().length, 9, 'presets must now cover the 9-split layout')
		assert.ok(self.presetDefinitions.window_9_mute, 'window 9 controls must exist')
	})
})

test('changing the config to an invalid host tears down the previous connection', async () => {
	await withInstance(async (self, device) => {
		await self.initConnection()
		const previous = self.DEVICE
		assert.ok(previous)

		self.config.host = '256.1.1.1'
		await self.initConnection()

		assert.equal(self.DEVICE, null)
		assert.equal(previous._closed, true, 'old client must be closed')
		assert.ok(
			device.requests.some((r) => r.url === '/api/r1/users/logout.json'),
			'old session must be logged out',
		)
		assert.match(self.statuses.at(-1), /^bad_config/)
		assert.equal(self.RECONNECT_INTERVAL, null)
	})
})

test('a follow-up resources refresh waits for an in-flight resources poll instead of being skipped', async () => {
	await withInstance(async (self, device) => {
		await self.initConnection()

		const before = device.requests.length
		const inFlight = self.checkResources()
		assert.ok(self.RESOURCES_CHECK_PROMISE, 'in-flight cycle must be published')

		await self.refreshStateAfterAction(true)
		await inFlight

		const hostnameReads = device.requests.slice(before).filter((r) => r.url === '/api/r1/system/getHostname.json')
		assert.equal(hostnameReads.length, 2, 'the follow-up must run its own cycle after the in-flight one')
		assert.equal(self.RESOURCES_CHECK_PROMISE, null)
	})
})

test('only changed variables are pushed after the first full set', async () => {
	await withInstance(async (self) => {
		await self.initConnection()

		const pushes = []
		self.setVariableValues = (values) => pushes.push(values)

		await self.checkState()
		assert.deepEqual(pushes, [], 'an unchanged poll must not push anything')

		await runAction(self, 'setRecording', { mode: 'start' })
		const keys = new Set(pushes.flatMap((push) => Object.keys(push)))
		assert.ok(keys.has('recording'))
		assert.ok(keys.has('recording_duration'))
		assert.ok(!keys.has('hostname'), 'unchanged values must not be re-sent')

		self.initVariables()
		pushes.length = 0
		await self.checkState()
		assert.equal(pushes.length, 1)
		assert.ok(Object.keys(pushes[0]).length > 50, 'rebuilt definitions get the full set again')
	})
})

test('start disk is sent in the type the device reported for choose', async () => {
	await withInstance(async (self, device) => {
		await self.initConnection()

		await runAction(self, 'setStartDisk', { disk: '1' })
		let call = device.requests.findLast((r) => r.url === '/api/r1/storage/setStoLimit.json')
		assert.deepEqual(call.body, { choose: '1', limitType: 'size', limitSize: 10, limitTime: 60 })

		device.state.chooseAsNumber = true
		await self.checkResources()
		await runAction(self, 'setFileSplit', { limitType: 'time', limitSize: 10, limitTime: 45 })
		call = device.requests.findLast((r) => r.url === '/api/r1/storage/setStoLimit.json')
		assert.deepEqual(call.body, { choose: 0, limitType: 'time', limitSize: 10, limitTime: 45 })
	})
})

test('a session that later fails to authenticate is retried a bounded number of times', async () => {
	await withInstance(async (self, device) => {
		self.RECONNECT_TIME = 10
		self.AUTH_RETRY_MAX = 2
		await self.initConnection()
		assert.equal(self.SESSION_ESTABLISHED, true)

		// the device now rejects every login (e.g. web service restarting)
		device.state.rejectLogins = true

		const unreachable = new Error('Token_Error')
		unreachable.authFailure = true
		await self.handleRequestError(unreachable, 'Poll failed')

		assert.ok(self.statuses.includes('connection_failure: Session lost, reconnecting'))
		assert.ok(self.logs.some((line) => /^warn: .*treated as transient \(attempt 1 of 2\)/.test(line)))
		assert.ok(self.RECONNECT_INTERVAL, 'first failure after a good session must schedule a retry')
		assert.equal(self.AUTH_RETRY_COUNT, 1)

		// let the reconnects run until the retries are exhausted
		for (let i = 0; i < 4 && !/^authentication_failure/.test(self.statuses.at(-1)); i++) {
			await new Promise((r) => setTimeout(r, 30))
			await self.INIT_CONNECTION_PROMISE
		}

		assert.match(self.statuses.at(-1), /^authentication_failure/)
		assert.equal(self.RECONNECT_INTERVAL, null, 'no further retries once exhausted')
		assert.equal(self.AUTH_RETRY_COUNT, 2)

		// once the device accepts logins again a config change starts fresh
		device.state.rejectLogins = false
		self.SESSION_ESTABLISHED = false
		self.AUTH_RETRY_COUNT = 0
		await self.initConnection()
		assert.equal(self.statuses.at(-1), 'ok')
	})
})

test('a bad password on first connect is final even though retries exist for lost sessions', async () => {
	await withInstance(async (self) => {
		self.secrets.password = 'wrong'
		await self.initConnection()

		assert.equal(self.AUTH_RETRY_COUNT, 0)
		assert.equal(self.RECONNECT_INTERVAL, null)
		assert.match(self.statuses.at(-1), /^authentication_failure/)
	})
})
