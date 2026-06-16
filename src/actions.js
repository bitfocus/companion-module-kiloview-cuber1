module.exports = {
	initActions: function () {
		let self = this
		let actions = {}

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
				await self.DEVICE.setLayout(options.layout_id)
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
				{
					type: 'textinput',
					label: 'Channel Name',
					id: 'channel_name',
					default: '',
				},
			],
			callback: async function (action) {
				let options = action.options
				let source = self.CHOICES_SOURCES.find((s) => s.id === options.source_id)
				if (source && source.id !== 'null') {
					let params = {
						type: 0,
						position: parseInt(options.position),
						disc_id: parseInt(source.id),
						disc_name: source.label,
						ip: source.url,
					}
					if (options.channel_name) {
						params.stream_id = options.channel_name
					}
					await self.DEVICE.setSource(params)
				} else if (source) {
					// Manual IP source
					let params = {
						type: 1,
						position: parseInt(options.position),
						ip: source.url,
						disc_name: source.label,
					}
					await self.DEVICE.setSource(params)
				}
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
				await self.DEVICE.setRecStatus(1)
			},
		}

		actions.stopRecording = {
			name: 'Stop All Recording',
			callback: async function (action) {
				await self.DEVICE.setRecStatus(0)
			},
		}

		actions.toggleRecording = {
			name: 'Toggle All Recording',
			callback: async function (action) {
				if (self.STATE.recording) {
					await self.DEVICE.setRecStatus(0)
				} else {
					await self.DEVICE.setRecStatus(1)
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