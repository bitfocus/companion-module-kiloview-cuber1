module.exports = {
	initActions: function () {
		let self = this
		let actions = {}

		const buildSourceParams = (sourceChoice, position) => {
			if (!sourceChoice || sourceChoice.id === 'null') {
				return null
			}

			try {
				let sourceData = JSON.parse(sourceChoice.id)
				return {
					type: sourceData.type || 'display',
					stream_id: sourceData.stream_id || '',
					position: parseInt(position),
					ip: sourceData.ip || '',
					disc_id: sourceData.disc_id || '',
					disc_name: sourceData.disc_name || '',
					server_on: !!sourceData.server_on,
					server_ip: sourceData.server_ip || '',
				}
			} catch (error) {
				self.log('error', 'Failed to parse selected NDI source: ' + error.message)
				return null
			}
		}

		// ===== General Actions =====
		actions.setLayout = {
			name: 'Set Layout',
			options: [
				{
					type: 'dropdown',
					label: 'Layout',
					id: 'layout_id',
					default: self.CHOICES_LAYOUTS[0].id,
					choices: self.CHOICES_LAYOUTS,
				},
			],
			callback: async function (action) {
				let options = action.options
				const result = await self.DEVICE.setLayout(options.layout_id)
				if (result && result.result === 'error') {
					self.log('error', `Set Layout failed: ${result.msg || 'Device rejected the layout request'}`)
					return
				}
				await self.checkState()
			},
		}

		actions.refreshStatus = {
			name: 'Refresh Device Status',
			callback: async function (action) {
				await self.checkState()
			},
		}

		actions.setHostname = {
			name: 'Set Hostname',
			options: [
				{
					type: 'textinput',
					label: 'Hostname',
					id: 'hostname',
					default: '',
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.setHostname(options.hostname)
			},
		}

		actions.setTimeZone = {
			name: 'Set Time Zone',
			options: [
				{
					type: 'textinput',
					label: 'Timezone',
					id: 'timezone',
					default: 'Asia/Shanghai',
				},
				{
					type: 'number',
					label: 'UTC Offset (hours)',
					id: 'offset',
					min: -12,
					max: 14,
					default: 8,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.setTimeZone(options.timezone, options.offset)
			},
		}

		actions.reboot = {
			name: 'Reboot Device',
			callback: async function (action) {
				await self.DEVICE.reboot()
			},
		}

		// ===== Source Assignment Actions =====
		actions.setSource = {
			name: 'Set Recording Source',
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					choices: self.CHOICES_POSITIONS_9,
				},
				{
					type: 'dropdown',
					label: 'NDI Source',
					id: 'source_id',
					default: self.CHOICES_SOURCES[0].id,
					choices: self.CHOICES_SOURCES,
				},
			],
			callback: async function (action) {
				let options = action.options
				let source = self.CHOICES_SOURCES.find((s) => s.id === options.source_id)
				let params = buildSourceParams(source, options.position)

				if (!params) {
					return
				}

				await self.DEVICE.setSource(params)
			},
		}

		actions.setFirstSource = {
			name: 'Set First Discovered Source',
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					choices: self.CHOICES_POSITIONS_9,
				},
			],
			callback: async function (action) {
				let options = action.options
				let firstSource = self.CHOICES_SOURCES.find((s) => s.id !== 'null')
				let params = buildSourceParams(firstSource, options.position)

				if (!params) {
					return
				}

				await self.DEVICE.setSource(params)
			},
		}

		actions.removeSource = {
			name: 'Remove Source from Position',
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					choices: self.CHOICES_POSITIONS_9,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.removeSource(parseInt(options.position))
			},
		}

		actions.removeAllSources = {
			name: 'Remove All Sources',
			callback: async function (action) {
				await self.DEVICE.removeAllSources()
			},
		}

		actions.setChannelName = {
			name: 'Set Channel Name',
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					choices: self.CHOICES_POSITIONS_9,
				},
				{
					type: 'textinput',
					label: 'Channel Name',
					id: 'name',
					default: '',
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.setChannelName(parseInt(options.position), options.name)
			},
		}

		actions.refreshSources = {
			name: 'Refresh NDI Sources',
			callback: async function (action) {
				await self.DEVICE.refreshSources()
				await self.checkSources()
			},
		}

		actions.addSource = {
			name: 'Add NDI Source',
			options: [
				{
					type: 'textinput',
					label: 'Source Name',
					id: 'disc_name',
					default: '',
				},
				{
					type: 'dropdown',
					label: 'Source Type',
					id: 'disc_type',
					default: 0,
					choices: self.CHOICES_SOURCE_TYPE,
				},
				{
					type: 'textinput',
					label: 'IP Address',
					id: 'ip',
					default: '',
				},
				{
					type: 'textinput',
					label: 'Group',
					id: 'group',
					default: '',
				},
			],
			callback: async function (action) {
				let options = action.options
				let params = {
					disc_name: options.disc_name,
					disc_type: parseInt(options.disc_type),
					ip: options.ip,
				}
				if (options.group) params.group = options.group
				await self.DEVICE.addSource(params)
			},
		}

		actions.removeSourceGroup = {
			name: 'Remove NDI Source Group',
			options: [
				{
					type: 'number',
					label: 'Source Group ID',
					id: 'disc_id',
					min: 1,
					default: 1,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.removeSourceGroup(parseInt(options.disc_id))
			},
		}

		// ===== Recording Actions =====
		actions.startRecording = {
			name: 'Start All Recording',
			callback: async function (action) {
				await self.DEVICE.setRecStatus(true)
			},
		}

		actions.stopRecording = {
			name: 'Stop All Recording',
			callback: async function (action) {
				await self.DEVICE.setRecStatus(false)
			},
		}

		actions.toggleRecording = {
			name: 'Toggle All Recording',
			callback: async function (action) {
				if (self.STATE.recording) {
					await self.DEVICE.setRecStatus(false)
				} else {
					await self.DEVICE.setRecStatus(true)
				}
			},
		}

		actions.startSingleRec = {
			name: 'Start Single Recording',
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					choices: self.CHOICES_POSITIONS_9,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.setSingleRec(parseInt(options.position), 1)
			},
		}

		actions.stopSingleRec = {
			name: 'Stop Single Recording',
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					choices: self.CHOICES_POSITIONS_9,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.setSingleRec(parseInt(options.position), 0)
			},
		}

		actions.setRecordMode = {
			name: 'Set Record Mode',
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_RECORD_MODES[0].id,
					choices: self.CHOICES_RECORD_MODES,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.setRecordMode(parseInt(options.mode))
			},
		}

		actions.setAudioLineIn = {
			name: 'Set Audio Line-In for Channel',
			options: [
				{
					type: 'dropdown',
					label: 'Position',
					id: 'position',
					default: 0,
					choices: self.CHOICES_POSITIONS_9,
				},
				{
					type: 'checkbox',
					label: 'Enable Line-In',
					id: 'enable',
					default: false,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.setLinIn(parseInt(options.position), options.enable ? 1 : 0)
			},
		}

		actions.setAudioLineInDelay = {
			name: 'Set Audio Line-In Delay',
			options: [
				{
					type: 'number',
					label: 'Delay (ms, -500 to 500)',
					id: 'delay',
					min: -500,
					max: 500,
					default: 0,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.setLinInDelay(parseInt(options.delay))
			},
		}

		// ===== Storage Actions =====
		actions.formatDisk = {
			name: 'Format Disk',
			options: [
				{
					type: 'dropdown',
					label: 'Disk',
					id: 'disk',
					default: 'ssd1',
					choices: self.CHOICES_DISK,
				},
			],
			callback: async function (action) {
				let options = action.options
				await self.DEVICE.formatDisk(options.disk)
			},
		}

		self.setActionDefinitions(actions)
	},
}
