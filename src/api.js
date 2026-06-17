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
			const outputResult = await self.DEVICE.getOutput()
			if (outputResult && outputResult.result === 'ok' && outputResult.data) {
				const newLayoutId = outputResult.data.layout_id
				const newLayoutNumber = outputResult.data.layout_number
				if (newLayoutId && self.STATE.layout_id !== newLayoutId) {
					self.STATE.layout_id = newLayoutId
					self.STATE.layout_number = newLayoutNumber || newLayoutId
					self.initActions()
					self.initFeedbacks()
					self.initVariables()
					self.initPresets()
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
			if (hostname && hostname.result === 'ok' && hostname.data) {
				self.STATE.hostname = hostname.data.hostname || ''
			}
		} catch (e) {
			if (self.config.verbose) {
				self.log('debug', 'Error getting hostname: ' + e.message)
			}
		}

		try {
			const systemInfo = await self.DEVICE.getSystemInfo()
			if (systemInfo && systemInfo.data) {
				self.STATE.cpu_usage = systemInfo.data.cpu != null ? Math.round(systemInfo.data.cpu) : ''
				self.STATE.gpu_usage = systemInfo.data.gpu != null ? systemInfo.data.gpu : ''
				self.STATE.memory_used = systemInfo.data.mem_use || ''
				self.STATE.memory_total = systemInfo.data.mem_total || ''
				self.STATE.temperature = systemInfo.data.temp != null ? systemInfo.data.temp + '°C' : ''
			}
		} catch (e) {
			if (self.config.verbose) {
				self.log('debug', 'Error getting system info: ' + e.message)
			}
		}

		try {
			const firmwareInfo = await self.DEVICE.getFirmwareInfo()
			if (firmwareInfo && firmwareInfo.data) {
				self.STATE.firmware_version = firmwareInfo.data.softwareVersion || ''
				self.STATE.product = firmwareInfo.data.product || ''
			}
		} catch (e) {
			if (self.config.verbose) {
				self.log('debug', 'Error getting firmware info: ' + e.message)
			}
		}

		try {
			const recStatus = await self.DEVICE.getRecStatus()
			if (recStatus && recStatus.data) {
				self.STATE.recording = recStatus.data.isRecording || false
				self.STATE.saving = recStatus.data.is_saving || false
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
			// output.data contains layout_id, layout_number, and a nested data array
			// output.data contains layout_id, layout_number, and a layout array of positions
			const outputPositions = Array.isArray(output.data.layout) ? output.data.layout : (Array.isArray(output.data.data) ? output.data.data : (Array.isArray(output.data) ? output.data : []))
				for (let i = 0; i < outputPositions.length; i++) {
				const pos = outputPositions[i]
				const posIndex = pos.position != null ? pos.position : (pos.id != null ? pos.id : i)
					self.STATE['source_' + (posIndex + 1) + '_name'] = pos.name || ''
					self.STATE['source_' + (posIndex + 1) + '_ip'] = pos.ip || ''
					self.STATE['source_' + (posIndex + 1) + '_online'] = pos.online != null ? pos.online : (pos.ip && pos.ip.length > 0)
					self.STATE['channel_' + (posIndex + 1) + '_name'] = pos.stream_name || pos.channelName || ''
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
