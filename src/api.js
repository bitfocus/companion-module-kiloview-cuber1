const { InstanceStatus } = require('@companion-module/base')

const cuber1Device = require('./kiloview')

module.exports = {
	async initConnection() {
		let self = this

		clearInterval(self.INTERVAL)
		clearInterval(self.INTERVAL_SOURCES)
		clearTimeout(self.RECONNECT_INTERVAL)

		if (self.config.host && self.config.host !== '') {
			self.updateStatus(InstanceStatus.Connecting)
			self.log('info', `Opening connection to ${self.config.host}`)
			self.STATE.layout_id = self.config.layout || 1

			self.DEVICE = new cuber1Device(
				this,
				self.config.host,
				self.config.username,
				self.config.password,
				self.config.port
			)

			let authorized = false

			if (self.config.useAuth === false) {
				self.log('info', 'No authentication required. Connecting to device...')
				authorized = true
			} else {
				try {
					self.log('info', 'Attempting to authorize...')
					authorized = await self.DEVICE.authorize()
				} catch (error) {
					if (error.name === 'Cuber1Error') {
						self.log('error', 'Authorization failed. Check your username and password and try again.')
						self.updateStatus(InstanceStatus.ConnectionFailure, 'Authorization Failed. See log.')
					} else {
						self.log('error', 'Could not reach device. Retrying in 30 seconds.')
						self.updateStatus(InstanceStatus.ConnectionFailure)
						self.startReconnectInterval()
					}
					return
				}
			}

			if (authorized === true) {
				self.updateStatus(InstanceStatus.Ok)
				self.log('info', `Connected to CUBE R1 device`)

				self.initActions()
				self.initFeedbacks()
				self.initVariables()
				self.initPresets()

				await new Promise((resolve) => setTimeout(resolve, 3000))

				await self.checkState()
				self.startInterval()
				self.startSourcesInterval()
			} else {
				self.log('error', 'Authorization failed. Check your username and password and try again.')
				self.updateStatus(InstanceStatus.ConnectionFailure, 'Authorization Failed. See log.')
			}
		}
	},

	startReconnectInterval: function () {
		let self = this

		self.updateStatus(InstanceStatus.ConnectionFailure, 'Reconnecting')

		if (self.RECONNECT_INTERVAL !== undefined) {
			clearTimeout(self.RECONNECT_INTERVAL)
			self.RECONNECT_INTERVAL = undefined
		}

		self.log('info', 'Attempting to reconnect in 30 seconds...')

		self.RECONNECT_INTERVAL = setTimeout(self.initConnection.bind(this), 30000)
	},

	startInterval: function () {
		let self = this

		if (self.config.polling) {
			if (self.config.pollingrate === undefined || self.config.pollingrate < 1000) {
				self.config.pollingrate = 1000
			}

			self.log('info', `Starting Update Interval: Fetching new data from Device every ${self.config.pollingrate}ms.`)
			self.INTERVAL = setInterval(self.checkState.bind(self), parseInt(self.config.pollingrate))
		} else {
			self.log(
				'info',
				'Polling is disabled. Module will not request new data at a regular rate. Feedbacks and Variables will not update.'
			)
		}
	},

	async startSourcesInterval() {
		let self = this

		if (self.config.polling) {
			if (self.config.pollingrate_sources === undefined || self.config.pollingrate_sources < 1000) {
				self.config.pollingrate_resources = 10000
			}

			self.INTERVAL_SOURCES = setInterval(
				self.checkSources.bind(self),
				parseInt(self.config.pollingrate_sources)
			)
		} else {
			self.log('info', 'Polling is disabled. Module will not request new NDI sources at a regular rate.')
		}
	},

	async checkState() {
		let self = this

		if (!self.DEVICE) {
			return
		}

		try {
			const layoutResult = await self.DEVICE.getLayoutList()
			if (layoutResult && layoutResult.result === 'ok' && layoutResult.data) {
				const layouts = layoutResult.data
				if (Array.isArray(layouts)) {
					const currentLayout = layouts.find((l) => l.current === true)
					if (currentLayout) {
						if (self.STATE.layout_id !== currentLayout.id) {
							self.STATE.layout_id = currentLayout.id
							self.STATE.layout_number = currentLayout.number || currentLayout.id
							self.initActions()
							self.initFeedbacks()
							self.initVariables()
							self.initPresets()
						}
					}
				}
			}
			self.updateStatus(InstanceStatus.Ok)
		} catch (e) {
			self.log('error', 'Error getting layout: ' + e.message)
			self.updateStatus(InstanceStatus.ConnectionFailure)
			self.startReconnectInterval()
			return
		}

		try {
			const hostname = await self.DEVICE.getHostname()
			if (hostname && hostname.result === 'ok') {
				self.STATE.hostname = hostname.data || ''
			}
		} catch (e) {
			if (self.config.verbose) {
				self.log('debug', 'Error getting hostname: ' + e.message)
			}
		}

		try {
			const systemInfo = await self.DEVICE.getSystemInfo()
			if (systemInfo && systemInfo.data) {
				self.STATE.product = systemInfo.data.version?.product || ''
				self.STATE.serial_number = systemInfo.data.version?.serialNumber || ''
				self.STATE.firmware_version = systemInfo.data.version?.softwareVersion || ''
				self.STATE.cpu_usage = systemInfo.data.cpu?.precent || ''
				self.STATE.gpu_usage = systemInfo.data.gpu?.precent || ''
				self.STATE.memory_used = systemInfo.data.mem?.used || ''
				self.STATE.memory_total = systemInfo.data.mem?.total || ''
				self.STATE.temperature = systemInfo.data.temperature || ''
			}
		} catch (e) {
			if (self.config.verbose) {
				self.log('debug', 'Error getting system info: ' + e.message)
			}
		}

		try {
			const recStatus = await self.DEVICE.getRecStatus()
			if (recStatus && recStatus.data) {
				self.STATE.recording = recStatus.data.isRecording || false
				self.STATE.saving = recStatus.data.isSaving || false
			}
		} catch (e) {
			if (self.config.verbose) {
				self.log('debug', 'Error getting recording status: ' + e.message)
			}
		}

		try {
			const recMode = await self.DEVICE.getRecordMode()
			if (recMode && recMode.data !== undefined) {
				self.STATE.record_mode = recMode.data === 0 ? 'Record' : recMode.data === 1 ? 'Director' : 'N/A'
			}
		} catch (e) {
			if (self.config.verbose) {
				self.log('debug', 'Error getting record mode: ' + e.message)
			}
		}

		try {
			const output = await self.DEVICE.getOutput()
			if (output && output.data) {
				self.STATE.output = output.data
				// Update position states
				if (Array.isArray(output.data)) {
					for (let i = 0; i < output.data.length; i++) {
						const pos = output.data[i]
						self.STATE['source_' + (pos.position + 1) + '_name'] = pos.name || ''
						self.STATE['source_' + (pos.position + 1) + '_ip'] = pos.ip || ''
						self.STATE['source_' + (pos.position + 1) + '_online'] = pos.online || false
						self.STATE['channel_' + (pos.position + 1) + '_name'] = pos.channelName || ''
					}
				}
			}
		} catch (e) {
			if (self.config.verbose) {
				self.log('debug', 'Error getting output: ' + e.message)
			}
		}

		self.checkFeedbacks()
		self.checkVariables()
	},

	async checkSources() {
		let self = this

		if (!self.DEVICE) {
			return
		}

		let sourcesArray = []

		try {
			const sources = await self.DEVICE.getSourceList()

			if (sources && sources.data && Array.isArray(sources.data)) {
				sources.data.forEach((source) => {
					if (source.disc_name) {
						sourcesArray.push({
							id: String(source.disc_id),
							url: source.ip || '',
							label: source.disc_name,
						})
					}
				})
			}

			if (sourcesArray.length === 0) {
				sourcesArray = [{ id: 'null', url: '', label: '- No sources available -' }]
			}
		} catch (e) {
			self.log('error', 'Error getting sources: ' + e.message)
			sourcesArray = [{ id: 'null', url: '', label: '- No sources available -' }]
		}

		if (JSON.stringify(self.CHOICES_SOURCES) !== JSON.stringify(sourcesArray)) {
			self.log('info', 'NDI Sources have changed. Updating Choices.')
			self.CHOICES_SOURCES = sourcesArray
			self.initActions()
			self.initFeedbacks()
			self.initVariables()
			self.initPresets()
		}
	},
}