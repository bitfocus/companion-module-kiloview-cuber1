import { InstanceStatus } from '@companion-module/base'

import KiloviewCubeR1 from './cuber1.js'
import constants from './constants.js'

/**
 * The device is the source of these values; a firmware quirk or a partial response can send
 * something other than the documented array. Coerce so downstream `.map()`/`.find()` cannot throw.
 */
function asArray(value) {
	return Array.isArray(value) ? value : []
}

function toInt(value, fallback = null) {
	const parsed = parseInt(value, 10)
	return Number.isFinite(parsed) ? parsed : fallback
}

function isObject(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default {
	disposeDevice: function (device) {
		if (!device) {
			return Promise.resolve()
		}

		// The logout is a courtesy to the device. On an unreachable device it would otherwise run
		// to the full request timeout, so it is capped; close() then aborts the pending request.
		let timer = null
		const cap = new Promise((resolve) => {
			timer = setTimeout(resolve, this.LOGOUT_TIMEOUT)
		})

		return Promise.race([device.logout().catch(() => {}), cap]).finally(() => {
			clearTimeout(timer)
			device.close()
		})
	},

	isConnectionCurrent: function (generation, device) {
		return this.CONNECTION_GENERATION === generation && this.DEVICE === device
	},

	disposeCurrentDevice: function () {
		const device = this.DEVICE
		this.DEVICE = null
		return this.disposeDevice(device)
	},

	parsePollingRate: function (value, min, max, defaultValue) {
		const rate = parseInt(value, 10)
		if (!Number.isFinite(rate) || rate < min) {
			return defaultValue
		}

		if (rate > max) {
			return max
		}

		return rate
	},

	resetRuntimeState: function () {
		let self = this

		Object.assign(self.STATE, constants.createDefaultState())

		const choices = constants.createDefaultChoiceSets()
		self.CHOICES_SOURCES = choices.CHOICES_SOURCES
		self.CHOICES_DISKS = choices.CHOICES_DISKS
		self.CHOICES_LAYOUTS = self.buildLayoutChoices()
		self.CHOICES_WINDOWS = self.buildWindowChoices()

		self.POLL_ERROR_COUNT = 0

		self.initActions()
		self.initFeedbacks()
		self.initVariables()
		self.initPresets()
		self.checkAllFeedbacks()
		self.checkVariables()
	},

	isPlaceholderChoiceId: function (value) {
		return value === 0 || value === '0'
	},

	handleConnectionFailure: function (error, context) {
		let self = this

		if (self._destroyed) {
			return Promise.resolve()
		}

		self.log('error', `${context}: ${error.message}`)
		self.updateStatus(InstanceStatus.ConnectionFailure)
		self.stopIntervals()

		// Arm the retry before disposing. We only get here because the device is unreachable, so
		// the logout() inside dispose runs to its full request timeout; waiting on it would push
		// the first reconnect attempt out by that much. The dispose promise is still returned so
		// callers keep propagating its errors.
		self.startReconnectInterval()

		return self.disposeCurrentDevice()
	},

	handleAuthFailure: function (error, context) {
		let self = this

		if (self._destroyed) {
			return Promise.resolve()
		}

		self.stopIntervals()

		if (self.shouldRetryAuthFailure()) {
			self.log(
				'warn',
				`${context}: ${error.message}. The session was valid earlier, so this is treated as transient (attempt ${self.AUTH_RETRY_COUNT} of ${self.AUTH_RETRY_MAX}).`,
			)
			self.updateStatus(InstanceStatus.ConnectionFailure, 'Session lost, reconnecting')
			self.startReconnectInterval()
			return self.disposeCurrentDevice()
		}

		self.log('error', `${context}: ${error.message}`)
		self.updateStatus(InstanceStatus.AuthenticationFailure, 'Authentication failed. Check credentials.')
		return self.disposeCurrentDevice().then(() => {
			self.resetRuntimeState()
		})
	},

	/**
	 * A login that fails after the same credentials already worked is more likely a device whose
	 * web service is restarting than a changed password, so it gets a bounded number of retries
	 * through the normal reconnect path before the module gives up with AuthenticationFailure.
	 */
	shouldRetryAuthFailure: function () {
		let self = this

		if (!self.SESSION_ESTABLISHED || self.AUTH_RETRY_COUNT >= self.AUTH_RETRY_MAX) {
			return false
		}

		self.AUTH_RETRY_COUNT++
		return true
	},

	handleRequestError: function (error, context) {
		if (this._destroyed) {
			return Promise.resolve()
		}

		if (error.authFailure === true) {
			return this.handleAuthFailure(error, context)
		}

		if (error.unreachable === true) {
			return this.handleConnectionFailure(error, context)
		}

		this.log('error', `${context}: ${error.message}`)
		return Promise.resolve()
	},

	stopIntervals: function () {
		let self = this

		clearInterval(self.INTERVAL)
		clearInterval(self.INTERVAL_RESOURCES)
		clearTimeout(self.RECONNECT_INTERVAL)

		self.INTERVAL = null
		self.INTERVAL_RESOURCES = null
		self.RECONNECT_INTERVAL = null
	},

	async refreshStateAfterAction(includeResources = false) {
		let self = this

		// A poll may already be in flight; wait for it to settle so the follow-up read sees
		// post-action state rather than racing the request that is already open.
		if (self.STATE_CHECK_PROMISE) {
			await self.STATE_CHECK_PROMISE.catch(() => {})
		}

		await self.checkState()

		if (includeResources) {
			if (self.RESOURCES_CHECK_PROMISE) {
				await self.RESOURCES_CHECK_PROMISE.catch(() => {})
			}

			await self.checkResources()
		}
	},

	async initConnection() {
		let self = this

		const run = async () => {
			if (self._destroyed) {
				return
			}

			self.stopIntervals()

			self.CONNECTION_GENERATION++
			const generation = self.CONNECTION_GENERATION

			const previousDevice = self.DEVICE
			self.DEVICE = null
			await self.disposeDevice(previousDevice)
			self.resetRuntimeState()

			if (!self.config.host || self.config.host === '') {
				self.updateStatus(InstanceStatus.Disconnected, 'No host configured')
				return
			}

			if (!KiloviewCubeR1.isValidHost(self.config.host)) {
				self.log('error', `Invalid host "${self.config.host}". Use a valid IPv4/IPv6 address or hostname.`)
				self.updateStatus(InstanceStatus.BadConfig, 'Invalid host configured')
				return
			}

			if (!self.isConnectionCurrent(generation, null)) {
				return
			}

			self.updateStatus(InstanceStatus.Connecting)
			self.log('info', `Opening connection to ${self.config.host}`)

			const device = new KiloviewCubeR1(
				self,
				self.config.host,
				self.config.username,
				self.getPassword(),
				self.config.protocol,
				self.config.port,
				{
					rejectUnauthorized: self.config.verify_tls === true,
					requestTimeout: self.config.request_timeout,
					maxBodyBytes: self.REQUEST_BODY_MAX_BYTES,
				},
			)
			self.DEVICE = device

			try {
				self.log('info', 'Attempting to log in...')
				await device.login()
			} catch (error) {
				if (!self.isConnectionCurrent(generation, device)) {
					return
				}

				self.DEVICE = null
				await self.disposeDevice(device)

				if (error.authFailure === true) {
					if (self.shouldRetryAuthFailure()) {
						self.log(
							'warn',
							`Login rejected (${error.message}) although the same credentials worked before. Retrying in 30 seconds (attempt ${self.AUTH_RETRY_COUNT} of ${self.AUTH_RETRY_MAX}).`,
						)
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Session lost, reconnecting')
						self.startReconnectInterval()
						return
					}

					self.log('error', 'Login failed. Check your username and password and try again.')
					self.resetRuntimeState()
					self.updateStatus(InstanceStatus.AuthenticationFailure, 'Login failed. See log.')
					return
				}

				self.log('error', 'Could not reach device: ' + error.message + '. Retrying in 30 seconds.')
				self.updateStatus(InstanceStatus.ConnectionFailure)
				self.startReconnectInterval()
				return
			}

			if (!self.isConnectionCurrent(generation, device)) {
				return
			}

			self.updateStatus(InstanceStatus.Ok)
			self.log('info', `Connected to CUBE R1 as user: ${self.config.username}`)
			self.SESSION_ESTABLISHED = true
			self.AUTH_RETRY_COUNT = 0

			await self.checkResources(generation, device)
			if (!self.isConnectionCurrent(generation, device)) {
				return
			}

			await self.checkState(generation, device)
			if (!self.isConnectionCurrent(generation, device)) {
				return
			}

			self.checkAllFeedbacks()
			self.checkVariables()

			if (!self.isConnectionCurrent(generation, device)) {
				return
			}

			self.startIntervals()
		}

		self.INIT_CONNECTION_PROMISE = (self.INIT_CONNECTION_PROMISE || Promise.resolve()).then(run).catch((error) => {
			self.log('error', 'initConnection error: ' + error.message)
		})

		return self.INIT_CONNECTION_PROMISE
	},

	startReconnectInterval: function () {
		let self = this

		if (self._destroyed || !self.config.host || self.config.host === '') {
			return
		}

		self.updateStatus(InstanceStatus.ConnectionFailure, 'Reconnecting')

		if (self.RECONNECT_INTERVAL !== undefined && self.RECONNECT_INTERVAL !== null) {
			clearTimeout(self.RECONNECT_INTERVAL)
			self.RECONNECT_INTERVAL = null
		}

		self.log('info', 'Attempting to reconnect in 30 seconds...')

		self.RECONNECT_INTERVAL = setTimeout(() => {
			if (self._destroyed) {
				return
			}

			self.initConnection().catch(() => {})
		}, self.RECONNECT_TIME)
	},

	startIntervals: function () {
		let self = this

		if (self.config.polling) {
			const pollingRate = self.parsePollingRate(self.config.pollingrate, 500, self.POLLINGRATE_MAX, self.POLLINGRATE)
			const pollingRateResources = self.parsePollingRate(
				self.config.pollingrate_resources,
				1000,
				self.POLLINGRATE_RESOURCES_MAX,
				self.POLLINGRATE_RESOURCES,
			)

			self.log('info', `Starting Update Interval: Fetching new data from Device every ${pollingRate}ms.`)
			// Timer callbacks are never awaited, so an escaping rejection would be fatal to the process.
			self.INTERVAL = setInterval(() => {
				self.checkState().catch((error) => self.log('error', 'Error polling device state: ' + error.message))
			}, pollingRate)
			self.INTERVAL_RESOURCES = setInterval(() => {
				self.checkResources().catch((error) => self.log('error', 'Error polling device resources: ' + error.message))
			}, pollingRateResources)
		} else {
			self.log(
				'info',
				'Polling is disabled. Module will not request new data at a regular rate. Feedbacks and Variables will not update.',
			)
		}
	},

	async checkState(generation, device) {
		let self = this

		if (generation === undefined) {
			generation = self.CONNECTION_GENERATION
		}
		if (device === undefined) {
			device = self.DEVICE
		}

		if (!device || !self.isConnectionCurrent(generation, device) || self.STATE_CHECK_IN_FLIGHT) {
			return
		}

		self.STATE_CHECK_IN_FLIGHT = true

		// Published so refreshStateAfterAction() can await the running check instead of polling a flag.
		const run = self._checkStateOnce(generation, device).finally(() => {
			self.STATE_CHECK_IN_FLIGHT = false
			if (self.STATE_CHECK_PROMISE === run) {
				self.STATE_CHECK_PROMISE = null
			}
		})
		self.STATE_CHECK_PROMISE = run

		return run
	},

	async _checkStateOnce(generation, device) {
		let self = this

		try {
			const output = await device.getOutput(self.PROJECT_ID)
			if (!self.isConnectionCurrent(generation, device)) {
				return
			}

			if (isObject(output?.data)) {
				self.STATE.layout_id = toInt(output.data.layout_id)
				self.STATE.layout_number = toInt(output.data.layout_number)
				self.STATE.windows = asArray(output.data.layout).filter((window) => isObject(window))
			}

			const record = await device.getRecordStatus(self.PROJECT_ID)
			if (!self.isConnectionCurrent(generation, device)) {
				return
			}

			if (isObject(record?.data)) {
				self.STATE.recording = record.data.isRecording === true
				self.STATE.record_start_time = toInt(record.data.startTime)
				self.STATE.record_msg = typeof record.data.msg === 'string' ? record.data.msg : ''
			}

			self.POLL_ERROR_COUNT = 0
			self.updateStatus(InstanceStatus.Ok)
		} catch (error) {
			if (error.unreachable === true || error.authFailure === true) {
				await self.handleRequestError(error, 'Error getting device state')
				return
			}

			self.log('error', 'Error getting device state: ' + error.message)
			self.POLL_ERROR_COUNT++
			if (self.POLL_ERROR_COUNT >= self.POLL_ERROR_WARNING_THRESHOLD) {
				self.updateStatus(InstanceStatus.UnknownWarning, 'Repeated errors polling device state')
			}
		}

		if (!self.isConnectionCurrent(generation, device)) {
			return
		}

		self.rebuildChoices()

		self.checkAllFeedbacks()
		self.checkVariables()
	},

	/**
	 * Runs one resource request and applies its result. Returns false when the connection was
	 * replaced or lost mid-request so the caller can stop the remaining requests of the cycle;
	 * a plain API error is logged and the cycle continues.
	 */
	async _fetchResource(generation, device, context, request, apply) {
		let self = this

		try {
			const result = await request()
			if (!self.isConnectionCurrent(generation, device)) {
				return false
			}

			apply(result)
			return true
		} catch (error) {
			if (error.unreachable === true || error.authFailure === true) {
				await self.handleRequestError(error, context)
				return false
			}

			self.log('error', `${context}: ${error.message}`)
			return true
		}
	},

	async checkResources(generation, device) {
		let self = this

		if (generation === undefined) {
			generation = self.CONNECTION_GENERATION
		}
		if (device === undefined) {
			device = self.DEVICE
		}

		if (!device || !self.isConnectionCurrent(generation, device) || self.RESOURCES_CHECK_IN_FLIGHT) {
			return
		}

		self.RESOURCES_CHECK_IN_FLIGHT = true

		// Published so refreshStateAfterAction() can await a running cycle instead of skipping it.
		const run = self._checkResourcesOnce(generation, device).finally(() => {
			self.RESOURCES_CHECK_IN_FLIGHT = false
			if (self.RESOURCES_CHECK_PROMISE === run) {
				self.RESOURCES_CHECK_PROMISE = null
			}
		})
		self.RESOURCES_CHECK_PROMISE = run

		return run
	},

	async _checkResourcesOnce(generation, device) {
		let self = this

		const steps = [
			[
				'Error getting source list',
				() => device.getSourceList(),
				(result) => {
					self.STATE.sources = self.flattenSources(result?.data)
				},
			],
			[
				'Error getting layout list',
				() => device.getLayouts(),
				(result) => {
					const layouts = asArray(result?.data)
						.filter((layout) => isObject(layout))
						.map((layout) => ({ id: toInt(layout.id), number: toInt(layout.number) }))
						.filter((layout) => layout.id !== null && layout.number !== null)

					// Keep the built-in 1/4/9 defaults rather than emptying the dropdown on a bad reply.
					if (layouts.length > 0) {
						self.STATE.layouts = layouts
						self.STATE.layouts_from_device = true
					}
				},
			],
			[
				'Error getting storage info',
				() => device.getStorageInfo(),
				(result) => {
					self.STATE.storage = isObject(result?.data) ? result.data : null
				},
			],
			[
				'Error getting performance info',
				() => device.getPerformance(),
				(result) => {
					self.STATE.performance = isObject(result?.data) ? result.data : null
				},
			],
			[
				'Error getting recording settings',
				() => device.getRecordInfo(),
				(result) => {
					self.STATE.record_info = isObject(result?.data) ? result.data : null
				},
			],
			[
				'Error getting hostname',
				() => device.getHostname(),
				(result) => {
					self.STATE.hostname = typeof result?.data?.hostname === 'string' ? result.data.hostname : ''
				},
			],
			[
				'Error getting firmware info',
				() => device.getFirmware(),
				(result) => {
					self.STATE.software_version = result?.data?.softwareVersion ?? ''
					self.STATE.firmware_version = result?.data?.firmwareVersion ?? ''
				},
			],
			[
				'Error getting network info',
				() => device.getNetwork(),
				(result) => {
					self.STATE.network = asArray(result?.data).filter((iface) => isObject(iface))
				},
			],
		]

		for (const [context, request, apply] of steps) {
			const keepGoing = await self._fetchResource(generation, device, context, request, apply)
			if (!keepGoing) {
				return
			}
		}

		if (!self.isConnectionCurrent(generation, device)) {
			return
		}

		self.rebuildChoices()

		self.checkAllFeedbacks()
		self.checkVariables()
	},

	/**
	 * /source/list.json returns discovery groups, each with its own `sources` array. Flatten them
	 * into one list keyed by the NDI stream id (which is what /output/setSource.json wants), and
	 * drop duplicates when the same stream is visible through more than one group.
	 */
	flattenSources: function (groups) {
		const sources = []
		const seen = new Set()

		for (const group of asArray(groups)) {
			if (!isObject(group)) {
				continue
			}

			for (const source of asArray(group.sources)) {
				if (!isObject(source)) {
					continue
				}

				const id = source.id ?? source.name
				if (id === undefined || id === null || String(id) === '') {
					continue
				}

				const key = String(id)
				if (seen.has(key)) {
					continue
				}
				seen.add(key)

				sources.push({
					id: key,
					name: typeof source.name === 'string' && source.name !== '' ? source.name : key,
					ip: typeof source.ip === 'string' ? source.ip : '',
					group: typeof group.disc_name === 'string' ? group.disc_name : '',
					disc_id: group.disc_id !== undefined && group.disc_id !== null ? String(group.disc_id) : '',
				})
			}
		}

		return sources
	},

	getWindowCount: function () {
		let self = this

		let count = self.MAX_WINDOWS
		for (const layout of asArray(self.STATE.layouts)) {
			if (Number.isFinite(layout.number) && layout.number > count) {
				count = layout.number
			}
		}

		for (const window of asArray(self.STATE.windows)) {
			const id = toInt(window.id)
			if (id !== null && id > count) {
				count = id
			}
		}

		return count
	},

	buildLayoutChoices: function () {
		let self = this

		const layouts = asArray(self.STATE?.layouts)
		if (layouts.length === 0) {
			return constants.DEFAULT_LAYOUTS.map((layout) => ({ id: layout.id, label: `${layout.number} Split` }))
		}

		return layouts.map((layout) => ({
			id: layout.id,
			label: layout.number === 1 ? '1 Split (Single)' : `${layout.number} Split`,
		}))
	},

	buildWindowChoices: function () {
		let self = this

		const count = self.getWindowCount()
		const choices = []
		for (let position = 1; position <= count; position++) {
			const window = self.getWindow(position)
			const name = typeof window?.name === 'string' && window.name !== '' ? ` (${window.name})` : ''
			choices.push({ id: position, label: `Window ${position}${name}` })
		}

		return choices
	},

	rebuildChoices: function () {
		let self = this

		// The discovery group only helps to tell sources apart when there is more than one group
		// (e.g. auto-discovery vs a manual cross-subnet entry), so it is shown only then.
		const groups = new Set(self.STATE.sources.map((source) => source.group).filter((group) => group !== ''))
		let sourceChoices = self.STATE.sources.map((source) => {
			let label = source.name
			if (groups.size > 1 && source.group) {
				label += ` [${source.group}]`
			}
			if (source.ip) {
				label += ` (${source.ip})`
			}
			return { id: source.id, label }
		})
		if (sourceChoices.length === 0) {
			sourceChoices = [{ ...constants.PLACEHOLDER_SOURCE }]
		}

		let diskChoices = self.getDisks().map((disk) => ({
			id: String(disk.id),
			label: disk.name || `Disk ${disk.id}`,
		}))
		if (diskChoices.length === 0) {
			diskChoices = [{ ...constants.PLACEHOLDER_DISK }]
		}

		const layoutChoices = self.buildLayoutChoices()
		const windowChoices = self.buildWindowChoices()

		// Window presets cover the current layout, not the maximum, so a layout switch has to
		// regenerate them even though the window dropdown itself is unchanged.
		const presetWindowCount = self.getPresetWindowCount()
		const presetsChanged = self.PRESET_WINDOW_COUNT !== presetWindowCount

		const changed =
			JSON.stringify(self.CHOICES_SOURCES) !== JSON.stringify(sourceChoices) ||
			JSON.stringify(self.CHOICES_DISKS) !== JSON.stringify(diskChoices) ||
			JSON.stringify(self.CHOICES_LAYOUTS) !== JSON.stringify(layoutChoices) ||
			JSON.stringify(self.CHOICES_WINDOWS) !== JSON.stringify(windowChoices)

		if (changed) {
			self.log('info', 'Sources/Disks/Layouts/Windows have changed. Updating choices...')
			self.CHOICES_SOURCES = sourceChoices
			self.CHOICES_DISKS = diskChoices
			self.CHOICES_LAYOUTS = layoutChoices
			self.CHOICES_WINDOWS = windowChoices

			self.initActions()
			self.initFeedbacks()
			self.initVariables()
			self.PRESET_WINDOW_COUNT = presetWindowCount
			self.initPresets()
		} else if (presetsChanged) {
			self.PRESET_WINDOW_COUNT = presetWindowCount
			self.initPresets()
		}
	},

	/**
	 * Presets are generated for the windows of the current layout; before the first poll (or
	 * with polling disabled) every possible window is covered so buttons can be built offline.
	 */
	getPresetWindowCount: function () {
		let self = this
		return self.STATE.layout_number || self.getWindowCount()
	},

	getWindow: function (position) {
		let self = this
		const wanted = toInt(position)
		if (wanted === null) {
			return undefined
		}

		return asArray(self.STATE?.windows).find((window) => toInt(window.id) === wanted)
	},

	getSourceById: function (source_id) {
		let self = this
		return asArray(self.STATE.sources).find((source) => source.id === String(source_id))
	},

	getDisks: function () {
		let self = this
		return asArray(self.STATE.storage?.disk).filter((disk) => isObject(disk))
	},

	getDiskById: function (disk_id) {
		let self = this
		return self.getDisks().find((disk) => String(disk.id) === String(disk_id))
	},

	getLayoutById: function (layout_id) {
		let self = this
		const wanted = toInt(layout_id)
		return asArray(self.STATE.layouts).find((layout) => layout.id === wanted)
	},

	/**
	 * A window's stream id is empty/absent when nothing is assigned. Older firmware may echo the
	 * name instead, so both are considered before declaring the window empty.
	 */
	windowHasSource: function (window) {
		if (!isObject(window)) {
			return false
		}

		const streamId = window.stream_id ?? window.stream_name
		return typeof streamId === 'string' ? streamId !== '' : streamId !== undefined && streamId !== null
	},
}
