function formatUptime(uptime) {
	if (!uptime || isNaN(uptime)) {
		return ''
	}

	const totalSeconds = Math.floor(uptime)
	const days = Math.floor(totalSeconds / 86400)
	const remainingSeconds = totalSeconds % 86400
	const hours = Math.floor(remainingSeconds / 3600)
	const minutes = Math.floor((remainingSeconds % 3600) / 60)
	const seconds = remainingSeconds % 60

	const hoursStr = hours.toString().padStart(2, '0')
	const minutesStr = minutes.toString().padStart(2, '0')
	const secondsStr = seconds.toString().padStart(2, '0')
	if (days > 0) {
		return `${days} Days ${hoursStr}:${minutesStr}:${secondsStr}`
	}

	return `${hoursStr}:${minutesStr}:${secondsStr}`
}

module.exports = {
	initVariables() {
		let self = this
		let variables = []

		// System variables
		variables.push({ variableId: 'hostname', name: 'Device Hostname' })
		variables.push({ variableId: 'product', name: 'Product Type' })
		variables.push({ variableId: 'serial_number', name: 'Device Serial Number' })
		variables.push({ variableId: 'firmware_version', name: 'Firmware Version' })

		// Layout variables
		variables.push({ variableId: 'layout', name: 'Current Layout (1/4/9)' })
		variables.push({ variableId: 'layout_number', name: 'Number of Channels in Current Layout' })

		// Recording variables
		variables.push({ variableId: 'recording', name: 'Recording Active' })
		variables.push({ variableId: 'saving', name: 'Saving in Progress' })
		variables.push({ variableId: 'record_mode', name: 'Current Record Mode' })

		// Performance variables
		variables.push({ variableId: 'cpu_usage', name: 'CPU Usage' })
		variables.push({ variableId: 'gpu_usage', name: 'GPU Usage' })
		variables.push({ variableId: 'memory_used', name: 'Memory Used' })
		variables.push({ variableId: 'memory_total', name: 'Memory Total' })
		variables.push({ variableId: 'temperature', name: 'Temperature' })
		variables.push({ variableId: 'uptime', name: 'Device Uptime' })

		// Per-position source variables (1-9)
		for (let i = 1; i <= 9; i++) {
			variables.push({ variableId: `source_${i}_name`, name: `Position ${i} Source Name` })
			variables.push({ variableId: `source_${i}_ip`, name: `Position ${i} Source IP` })
			variables.push({ variableId: `source_${i}_online`, name: `Position ${i} Source Online` })
			variables.push({ variableId: `channel_${i}_name`, name: `Position ${i} Channel Name` })
		}

		// Storage variables
		for (let i = 1; i <= 2; i++) {
			variables.push({ variableId: `ssd${i}_usage`, name: `SSD${i} Usage` })
			variables.push({ variableId: `ssd${i}_total`, name: `SSD${i} Total Size` })
			variables.push({ variableId: `ssd${i}_free`, name: `SSD${i} Free Space` })
		}

		self.setVariableDefinitions(variables)
	},

	checkVariables() {
		let self = this

		try {
			let variableObj = {}

			// System
			variableObj.hostname = self.STATE.hostname || ''
			variableObj.product = self.STATE.product || ''
			variableObj.serial_number = self.STATE.serial_number || ''
			variableObj.firmware_version = self.STATE.firmware_version || ''

			// Layout
			const layoutLabels = { 1: '1 Split', 2: '4 Split', 3: '9 Split' }
			variableObj.layout = layoutLabels[self.STATE.layout_id] || 'N/A'
			variableObj.layout_number = self.STATE.layout_number || ''

			// Recording
			variableObj.recording = self.STATE.recording ? 'True' : 'False'
			variableObj.saving = self.STATE.saving ? 'True' : 'False'
			variableObj.record_mode = self.STATE.record_mode || 'N/A'

			// Performance
			variableObj.cpu_usage = self.STATE.cpu_usage ? self.STATE.cpu_usage + '%' : ''
			variableObj.gpu_usage = self.STATE.gpu_usage ? self.STATE.gpu_usage + '%' : ''
			variableObj.memory_used = self.STATE.memory_used ? self.STATE.memory_used + 'KB' : ''
			variableObj.memory_total = self.STATE.memory_total ? self.STATE.memory_total + 'KB' : ''
			variableObj.temperature = self.STATE.temperature || ''

			// Per-position source variables
			for (let i = 1; i <= 9; i++) {
				variableObj[`source_${i}_name`] = self.STATE[`source_${i}_name`] || ''
				variableObj[`source_${i}_ip`] = self.STATE[`source_${i}_ip`] || ''
				variableObj[`source_${i}_online`] = self.STATE[`source_${i}_online`] ? 'True' : 'False'
				variableObj[`channel_${i}_name`] = self.STATE[`channel_${i}_name`] || ''
			}

			// Storage
			if (self.STATE.storage) {
				for (let i = 1; i <= 2; i++) {
					const disk = self.STATE.storage[`ssd${i}`]
					if (disk) {
						variableObj[`ssd${i}_usage`] = disk.usage || ''
						variableObj[`ssd${i}_total`] = disk.total || ''
						variableObj[`ssd${i}_free`] = disk.free || ''
					}
				}
			}

			self.setVariableValues(variableObj)
		} catch (error) {
			self.log('error', 'Error setting Variables: ' + String(error))
		}
	},
}