const { combineRgb } = require('@companion-module/base')

module.exports = {
	initFeedbacks: function () {
		let self = this
		let feedbacks = {}

		const colorWhite = combineRgb(255, 255, 255)
		const colorRed = combineRgb(255, 0, 0)
		const colorGreen = combineRgb(0, 255, 0)
		const colorBlue = combineRgb(0, 0, 255)
		const colorOrange = combineRgb(255, 165, 0)

		// Layout feedback
		feedbacks.layout = {
			type: 'boolean',
			name: 'Current Layout',
			description: 'Change the button color based on the current layout',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Layout',
					id: 'layout_id',
					default: self.CHOICES_LAYOUTS[0].id,
					choices: self.CHOICES_LAYOUTS,
				},
			],
			callback: function (feedback, bank) {
				let options = feedback.options
				if (options.layout_id == self.STATE.layout_id) {
					return true
				}
				return false
			},
		}

		// Recording status feedback
		feedbacks.recording = {
			type: 'boolean',
			name: 'Recording Status',
			description: 'Change the button color based on whether recording is active',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Change color if',
					id: 'compare',
					default: 'recording',
					choices: [
						{ id: 'recording', label: 'Recording' },
						{ id: 'not_recording', label: 'Not Recording' },
					],
				},
			],
			callback: function (feedback, bank) {
				let options = feedback.options
				if (options.compare === 'recording' && self.STATE.recording === true) {
					return true
				}
				if (options.compare === 'not_recording' && self.STATE.recording === false) {
					return true
				}
				return false
			},
		}

		// Saving (backup in progress) feedback
		feedbacks.saving = {
			type: 'boolean',
			name: 'Saving in Progress',
			description: 'Change the button color when backup/save is in progress',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorOrange,
			},
			options: [],
			callback: function (feedback, bank) {
				return self.STATE.saving === true
			},
		}

		// Record mode feedback
		feedbacks.recordMode = {
			type: 'boolean',
			name: 'Record Mode',
			description: 'Change the button color based on current record mode',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorRed,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_RECORD_MODES[0].id,
					choices: self.CHOICES_RECORD_MODES,
				},
			],
			callback: function (feedback, bank) {
				let options = feedback.options
				const modeLabel = options.mode == 0 ? 'Record' : 'Director'
				if (modeLabel == self.STATE.record_mode) {
					return true
				}
				return false
			},
		}

		// Source online feedback for each position
		feedbacks.sourceOnline = {
			type: 'boolean',
			name: 'Source Online at Position',
			description: 'Change the button color based on whether a source is connected at a position',
			defaultStyle: {
				color: colorWhite,
				bgcolor: colorGreen,
			},
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
					label: 'Change color if source is',
					id: 'compare',
					default: 'online',
					choices: [
						{ id: 'online', label: 'Online' },
						{ id: 'offline', label: 'Offline' },
					],
				},
			],
			callback: function (feedback, bank) {
				let options = feedback.options
				const posKey = 'source_' + (parseInt(options.position) + 1) + '_online'
				const isOnline = self.STATE[posKey] === true
				if (options.compare === 'online' && isOnline) {
					return true
				}
				if (options.compare === 'offline' && !isOnline) {
					return true
				}
				return false
			},
		}

		self.setFeedbackDefinitions(feedbacks)
	},
}