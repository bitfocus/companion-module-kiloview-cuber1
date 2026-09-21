function pad2(value) {
	return String(value).padStart(2, '0')
}

function formatDuration(milliseconds) {
	if (!Number.isFinite(milliseconds) || milliseconds < 0) {
		return ''
	}

	const totalSeconds = Math.floor(milliseconds / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

function formatTimestamp(milliseconds) {
	if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
		return ''
	}

	const date = new Date(milliseconds)
	if (Number.isNaN(date.getTime())) {
		return ''
	}

	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function formatBitrate(bits) {
	const value = parseFloat(bits)
	if (!Number.isFinite(value)) {
		return ''
	}

	if (value >= 1000000) {
		return `${(value / 1000000).toFixed(1)} Mbps`
	}

	return `${Math.round(value / 1000)} kbps`
}

function yesNo(value) {
	return value ? 'True' : 'False'
}

export default {
	initVariables() {
		let self = this
		let variables = {}

		// Device
		variables.hostname = { name: 'Device Hostname' }
		variables.software_version = { name: 'Software Version' }
		variables.firmware_version = { name: 'Firmware Version' }
		variables.ip_address = { name: 'IP Address (first active interface)' }
		variables.cpu = { name: 'CPU Usage (%)' }
		variables.gpu = { name: 'GPU Usage (%)' }
		variables.temperature_c = { name: 'CPU Temperature (Celsius)' }
		variables.temperature_f = { name: 'CPU Temperature (Fahrenheit)' }
		variables.memory = { name: 'Memory Usage (%)' }
		variables.memory_used = { name: 'Memory Used (MB)' }
		variables.memory_total = { name: 'Memory Total (MB)' }
		variables.net_up = { name: 'Network Upload Speed (KB/s)' }
		variables.net_down = { name: 'Network Download Speed (KB/s)' }

		// Recording
		variables.recording = { name: 'Recording Active' }
		variables.recording_start_time = { name: 'Recording Start Time' }
		variables.recording_duration = { name: 'Recording Duration (HH:MM:SS)' }
		variables.recording_message = { name: 'Recording Status Message' }
		variables.transcoding = { name: 'Recording Transcoding Method' }
		variables.force_time_sync = { name: 'Forced Time Synchronization' }
		variables.scheduled_start_enabled = { name: 'Scheduled Recording Start Enabled' }
		variables.scheduled_start_time = { name: 'Scheduled Recording Start Time' }
		variables.scheduled_stop_enabled = { name: 'Scheduled Recording Stop Enabled' }
		variables.scheduled_stop_time = { name: 'Scheduled Recording Stop Time' }

		// Layout
		variables.layout_id = { name: 'Current Layout ID' }
		variables.layout_number = { name: 'Current Layout Window Count' }

		// Sources
		variables.source_count = { name: 'Number of Discovered NDI Sources' }

		// Per-window
		const windowCount = self.getWindowCount()
		for (let idx = 1; idx <= windowCount; idx++) {
			variables[`window_${idx}_name`] = { name: `Window ${idx} Name` }
			variables[`window_${idx}_source`] = { name: `Window ${idx} Source Name` }
			variables[`window_${idx}_source_ip`] = { name: `Window ${idx} Source IP` }
			variables[`window_${idx}_bitrate`] = { name: `Window ${idx} Bitrate` }
			variables[`window_${idx}_ntp`] = { name: `Window ${idx} NTP State` }
			variables[`window_${idx}_audio`] = { name: `Window ${idx} Audio On` }
			variables[`window_${idx}_video_shown`] = { name: `Window ${idx} Video Shown` }
			variables[`window_${idx}_audio_meter_shown`] = { name: `Window ${idx} Audio Meter Shown` }
		}

		// Storage
		variables.start_disk = { name: 'Start Disk' }
		variables.file_split_type = { name: 'Recording File Split Rule' }
		variables.file_split_size = { name: 'Recording File Size Limit (GB)' }
		variables.file_split_time = { name: 'Recording File Duration Limit (minutes)' }

		const diskCount = Math.max(self.MIN_DISKS, self.getDisks().length)
		for (let idx = 1; idx <= diskCount; idx++) {
			variables[`disk_${idx}_name`] = { name: `Disk ${idx} Name` }
			variables[`disk_${idx}_state`] = { name: `Disk ${idx} State` }
			variables[`disk_${idx}_unlocked`] = { name: `Disk ${idx} Unlocked` }
			variables[`disk_${idx}_recording`] = { name: `Disk ${idx} Recording` }
			variables[`disk_${idx}_total`] = { name: `Disk ${idx} Total Capacity` }
			variables[`disk_${idx}_used`] = { name: `Disk ${idx} Used Capacity` }
			variables[`disk_${idx}_usage`] = { name: `Disk ${idx} Usage (%)` }
			variables[`disk_${idx}_speed`] = { name: `Disk ${idx} Write Speed` }
			variables[`disk_${idx}_message`] = { name: `Disk ${idx} Message` }
		}

		// Definitions were rebuilt, so the next checkVariables() must resend every value.
		self.LAST_VARIABLE_VALUES = null
		self.setVariableDefinitions(variables)
	},

	checkVariables() {
		let self = this

		try {
			let variableObj = {}

			// Device
			variableObj.hostname = self.STATE.hostname || ''
			variableObj.software_version = self.STATE.software_version || ''
			variableObj.firmware_version = self.STATE.firmware_version || ''

			const activeInterface = self.STATE.network.find(
				(iface) => iface.state === 'up' && iface.ip && iface.ip !== '0.0.0.0',
			)
			variableObj.ip_address = activeInterface?.ip || ''

			const perf = self.STATE.performance
			variableObj.cpu = ''
			variableObj.gpu = ''
			variableObj.temperature_c = ''
			variableObj.temperature_f = ''
			variableObj.memory = ''
			variableObj.memory_used = ''
			variableObj.memory_total = ''
			variableObj.net_up = ''
			variableObj.net_down = ''

			if (perf) {
				const cpu = parseFloat(perf.cpu)
				const gpu = parseFloat(perf.gpu)
				const temp = parseFloat(perf.temp)
				const memUse = parseFloat(perf.mem_use)
				const memTotal = parseFloat(perf.mem_total)

				variableObj.cpu = Number.isFinite(cpu) ? Math.round(cpu) + '%' : ''
				variableObj.gpu = Number.isFinite(gpu) ? Math.round(gpu) + '%' : ''
				variableObj.temperature_c = Number.isFinite(temp) ? Math.round(temp) + '°C' : ''
				variableObj.temperature_f = Number.isFinite(temp) ? Math.round((temp * 9) / 5 + 32) + '°F' : ''
				variableObj.memory_used = Number.isFinite(memUse) ? Math.round(memUse) : ''
				variableObj.memory_total = Number.isFinite(memTotal) ? Math.round(memTotal) : ''
				variableObj.memory =
					Number.isFinite(memUse) && Number.isFinite(memTotal) && memTotal > 0
						? Math.round((memUse / memTotal) * 100) + '%'
						: ''
				variableObj.net_up = perf.net_up ?? ''
				variableObj.net_down = perf.net_down ?? ''
			}

			// Recording
			variableObj.recording = yesNo(self.STATE.recording)
			variableObj.recording_message = self.STATE.record_msg || ''
			variableObj.recording_start_time = ''
			variableObj.recording_duration = ''
			if (self.STATE.recording && self.STATE.record_start_time) {
				variableObj.recording_start_time = formatTimestamp(self.STATE.record_start_time)
				variableObj.recording_duration = formatDuration(Date.now() - self.STATE.record_start_time)
			}

			const info = self.STATE.record_info
			variableObj.transcoding = ''
			variableObj.force_time_sync = ''
			variableObj.scheduled_start_enabled = ''
			variableObj.scheduled_start_time = ''
			variableObj.scheduled_stop_enabled = ''
			variableObj.scheduled_stop_time = ''
			if (info) {
				const transcoding = self.CHOICES_TRANSCODING.find((choice) => choice.id === parseInt(info.solution))
				variableObj.transcoding = transcoding?.label || ''
				variableObj.force_time_sync = yesNo(info.sync === true)
				variableObj.scheduled_start_enabled = yesNo(info.isStart === true)
				variableObj.scheduled_start_time = info.startTime || ''
				variableObj.scheduled_stop_enabled = yesNo(info.isStop === true)
				variableObj.scheduled_stop_time = info.stopTime || ''
			}

			// Layout
			variableObj.layout_id = self.STATE.layout_id ?? ''
			variableObj.layout_number = self.STATE.layout_number ?? ''

			// Sources
			variableObj.source_count = self.STATE.sources.length

			// Per-window
			const windowCount = self.getWindowCount()
			for (let idx = 1; idx <= windowCount; idx++) {
				const window = self.getWindow(idx)

				variableObj[`window_${idx}_name`] = window?.name || ''
				variableObj[`window_${idx}_source`] = ''
				variableObj[`window_${idx}_source_ip`] = ''
				variableObj[`window_${idx}_bitrate`] = ''
				variableObj[`window_${idx}_ntp`] = ''
				variableObj[`window_${idx}_audio`] = ''
				variableObj[`window_${idx}_video_shown`] = ''
				variableObj[`window_${idx}_audio_meter_shown`] = ''

				if (!window) {
					continue
				}

				if (self.windowHasSource(window)) {
					const streamId = String(window.stream_id ?? window.stream_name)
					const source = self.getSourceById(streamId)
					variableObj[`window_${idx}_source`] = window.stream_name || source?.name || streamId
					variableObj[`window_${idx}_source_ip`] = source?.ip || ''
					variableObj[`window_${idx}_bitrate`] = formatBitrate(window.bit_rate)
				}

				variableObj[`window_${idx}_ntp`] = window.ntp_state || ''
				variableObj[`window_${idx}_audio`] =
					window.volume === 'on' || window.volume === 'off' ? yesNo(window.volume === 'on') : ''
				variableObj[`window_${idx}_video_shown`] = yesNo(window.showVideo === true)
				variableObj[`window_${idx}_audio_meter_shown`] = yesNo(window.showVolume === true)
			}

			// Storage
			const storage = self.STATE.storage
			const disks = self.getDisks()
			const startDisk = storage ? disks.find((disk) => String(disk.id) === String(storage.choose)) : undefined
			variableObj.start_disk = startDisk?.name || (storage?.choose !== undefined ? String(storage.choose) : '')

			const splitType = self.CHOICES_SPLIT_TYPE.find((choice) => choice.id === storage?.limitType)
			variableObj.file_split_type = splitType?.label || ''
			variableObj.file_split_size = storage?.limitSize ?? ''
			variableObj.file_split_time = storage?.limitTime ?? ''

			const diskCount = Math.max(self.MIN_DISKS, disks.length)
			for (let idx = 1; idx <= diskCount; idx++) {
				const disk = disks[idx - 1]

				variableObj[`disk_${idx}_name`] = disk?.name || ''
				variableObj[`disk_${idx}_state`] = disk?.state || ''
				variableObj[`disk_${idx}_unlocked`] = disk ? yesNo(disk.unlock === true) : ''
				variableObj[`disk_${idx}_recording`] = disk ? yesNo(disk.recoding === true || disk.recording === true) : ''
				variableObj[`disk_${idx}_total`] = disk?.total || ''
				variableObj[`disk_${idx}_used`] = disk?.used || ''
				variableObj[`disk_${idx}_usage`] = disk?.rate !== undefined && disk?.rate !== null ? disk.rate + '%' : ''
				variableObj[`disk_${idx}_speed`] = disk?.speed ?? ''
				variableObj[`disk_${idx}_message`] = disk?.msg || ''
			}

			// Only push what changed; the state poll runs every second and nearly all of these
			// values are static between polls.
			const previous = self.LAST_VARIABLE_VALUES
			let changed = variableObj
			if (previous) {
				changed = {}
				for (const [key, value] of Object.entries(variableObj)) {
					if (previous[key] !== value) {
						changed[key] = value
					}
				}
			}

			self.LAST_VARIABLE_VALUES = variableObj
			if (Object.keys(changed).length > 0) {
				self.setVariableValues(changed)
			}
		} catch (error) {
			self.log('error', 'Error setting Variables: ' + String(error))
		}
	},
}
