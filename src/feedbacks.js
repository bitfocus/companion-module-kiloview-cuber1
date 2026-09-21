import { combineRgb } from '@companion-module/base'

export default {
	initFeedbacks: function () {
		let self = this
		let feedbacks = {}

		const colorWhite = combineRgb(255, 255, 255)
		const colorRed = combineRgb(255, 0, 0)
		const colorGreen = combineRgb(0, 255, 0)
		const colorOrange = combineRgb(255, 165, 0)

		const windowOption = {
			type: 'dropdown',
			label: 'Window',
			id: 'window',
			default: self.CHOICES_WINDOWS[0].id,
			choices: self.CHOICES_WINDOWS,
		}

		const sourceChoicesWithAny = [{ id: 'any', label: '- Any Source -' }, ...self.CHOICES_SOURCES]

		// ------------------------------------------------------------------
		// Recording
		// ------------------------------------------------------------------

		feedbacks.recordingActive = {
			type: 'boolean',
			name: 'Recording: Recording is Active',
			description: 'Change the button style while the device is recording',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorRed,
			},
			options: [],
			callback: function () {
				return self.STATE.recording === true
			},
		}

		feedbacks.transcodingActive = {
			type: 'boolean',
			name: 'Recording: Transcoding Method is Selected',
			description: 'Change the button style if the selected transcoding method is configured for recordings',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorGreen,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Transcoding',
					id: 'solution',
					default: self.CHOICES_TRANSCODING[0].id,
					choices: self.CHOICES_TRANSCODING,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				const solution = self.STATE.record_info?.solution
				return solution !== undefined && solution !== null && parseInt(solution) === parseInt(options.solution)
			},
		}

		// ------------------------------------------------------------------
		// Layout
		// ------------------------------------------------------------------

		feedbacks.layoutActive = {
			type: 'boolean',
			name: 'Layout: Layout is Active',
			description: 'Change the button style if the selected layout is the current multiview layout',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Layout',
					id: 'layout',
					default: self.CHOICES_LAYOUTS[0].id,
					choices: self.CHOICES_LAYOUTS,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				return self.STATE.layout_id !== null && self.STATE.layout_id == options.layout
			},
		}

		// ------------------------------------------------------------------
		// Windows
		// ------------------------------------------------------------------

		feedbacks.windowSource = {
			type: 'boolean',
			name: 'Window: Window has Source',
			description:
				'Change the button style if the selected window has the selected NDI source (or any source) assigned',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorRed,
			},
			options: [
				windowOption,
				{
					type: 'dropdown',
					label: 'NDI Source',
					id: 'source',
					default: sourceChoicesWithAny[0].id,
					choices: sourceChoicesWithAny,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				const window = self.getWindow(options.window)

				if (!self.windowHasSource(window)) {
					return false
				}

				if (options.source === 'any') {
					return true
				}

				return String(window.stream_id ?? window.stream_name) === String(options.source)
			},
		}

		feedbacks.windowEmpty = {
			type: 'boolean',
			name: 'Window: Window has No Source',
			description: 'Change the button style if the selected window has no NDI source assigned',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorOrange,
			},
			options: [windowOption],
			callback: function (feedback) {
				let options = feedback.options
				return !self.windowHasSource(self.getWindow(options.window))
			},
		}

		feedbacks.windowMuted = {
			type: 'boolean',
			name: 'Window: Window Audio is Muted',
			description: 'Change the button style if the audio of the selected window is switched off',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorRed,
			},
			options: [windowOption],
			callback: function (feedback) {
				let options = feedback.options
				// Only a reported 'off' counts; a window with no source has no volume field at all.
				return self.getWindow(options.window)?.volume === 'off'
			},
		}

		feedbacks.windowDisplay = {
			type: 'boolean',
			name: 'Window: Window Video / Audio Meter is Shown or Hidden',
			description:
				'Change the button style based on whether the video or audio meter of the selected window is displayed',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorOrange,
			},
			options: [
				windowOption,
				{
					type: 'dropdown',
					label: 'Target',
					id: 'target',
					default: 'video',
					choices: [
						{ id: 'video', label: 'Video' },
						{ id: 'audio', label: 'Audio Meter' },
					],
				},
				{
					type: 'dropdown',
					label: 'Change style if it is',
					id: 'state',
					default: self.CHOICES_SHOWN_HIDDEN[1].id,
					choices: self.CHOICES_SHOWN_HIDDEN,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				const window = self.getWindow(options.window)

				if (!window) {
					return false
				}

				const shown = options.target === 'audio' ? window.showVolume === true : window.showVideo === true
				return options.state === 'shown' ? shown : !shown
			},
		}

		feedbacks.windowNtpState = {
			type: 'boolean',
			name: 'Window: Window NTP State',
			description:
				'Change the button style based on the NTP synchronization state of the source in the selected window',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorGreen,
			},
			options: [
				windowOption,
				{
					type: 'dropdown',
					label: 'NTP State',
					id: 'state',
					default: self.CHOICES_NTP_STATE[0].id,
					choices: self.CHOICES_NTP_STATE,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				const window = self.getWindow(options.window)
				return window !== undefined && window.ntp_state === options.state
			},
		}

		// ------------------------------------------------------------------
		// Sources
		// ------------------------------------------------------------------

		feedbacks.sourceDiscovered = {
			type: 'boolean',
			name: 'Sources: Source is Discovered',
			description: 'Change the button style if the selected NDI source is currently in the discovery list',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorGreen,
			},
			options: [
				{
					type: 'dropdown',
					label: 'NDI Source',
					id: 'source',
					default: self.CHOICES_SOURCES[0].id,
					choices: self.CHOICES_SOURCES,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				return self.getSourceById(options.source) !== undefined
			},
		}

		// ------------------------------------------------------------------
		// Storage
		// ------------------------------------------------------------------

		feedbacks.diskState = {
			type: 'boolean',
			name: 'Storage: Disk State',
			description: 'Change the button style based on the state of the selected disk',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorGreen,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Disk',
					id: 'disk',
					default: self.CHOICES_DISKS[0].id,
					choices: self.CHOICES_DISKS,
				},
				{
					type: 'dropdown',
					label: 'Change style if disk is',
					id: 'state',
					default: self.CHOICES_DISK_STATE[0].id,
					choices: self.CHOICES_DISK_STATE,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				const disk = self.getDiskById(options.disk)

				if (!disk) {
					return false
				}

				switch (options.state) {
					case 'online':
						return disk.state === 'online'
					case 'offline':
						return disk.state !== 'online'
					case 'unlocked':
						return disk.unlock === true
					case 'locked':
						return disk.unlock !== true
					case 'recording':
						// The API spells this field "recoding"; accept the corrected spelling too.
						return disk.recoding === true || disk.recording === true
					default:
						return false
				}
			},
		}

		feedbacks.diskUsage = {
			type: 'boolean',
			name: 'Storage: Disk Usage Above Threshold',
			description: 'Change the button style if the used percentage of the selected disk is at or above the threshold',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Disk',
					id: 'disk',
					default: self.CHOICES_DISKS[0].id,
					choices: self.CHOICES_DISKS,
				},
				{
					type: 'number',
					label: 'Threshold (%)',
					id: 'threshold',
					default: 90,
					min: 0,
					max: 100,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				const disk = self.getDiskById(options.disk)
				const rate = parseFloat(disk?.rate)

				if (!Number.isFinite(rate)) {
					return false
				}

				return rate >= parseFloat(options.threshold)
			},
		}

		feedbacks.startDisk = {
			type: 'boolean',
			name: 'Storage: Disk is the Start Disk',
			description: 'Change the button style if the selected disk is the one new recordings are written to first',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorGreen,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Disk',
					id: 'disk',
					default: self.CHOICES_DISKS[0].id,
					choices: self.CHOICES_DISKS,
				},
			],
			callback: function (feedback) {
				let options = feedback.options
				const choose = self.STATE.storage?.choose
				return choose !== undefined && choose !== null && String(choose) === String(options.disk)
			},
		}

		self.setFeedbackDefinitions(feedbacks)
	},
}
