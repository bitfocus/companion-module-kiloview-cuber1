const { combineRgb } = require('@companion-module/base')

module.exports = {
	initPresets: function () {
		let self = this
		let presets = []

		const colorWhite = combineRgb(255, 255, 255)
		const colorBlack = combineRgb(0, 0, 0)
		const colorRed = combineRgb(255, 0, 0)
		const colorGreen = combineRgb(0, 255, 0)
		const colorBlue = combineRgb(0, 0, 255)
		const colorOrange = combineRgb(255, 165, 0)

		// ===== General Presets =====
		presets.push({
			category: 'General',
			type: 'button',
			name: 'Refresh Device Status',
			style: {
				text: 'Refresh',
				size: '14',
				color: colorWhite,
				bgcolor: colorBlue,
			},
			steps: [
				{
					down: [
						{
							actionId: 'refreshStatus',
						},
					],
					up: [],
				},
			],
		})

		presets.push({
			category: 'General',
			type: 'button',
			name: 'Reboot Device',
			style: {
				text: 'Reboot',
				size: '14',
				color: colorWhite,
				bgcolor: colorRed,
			},
			steps: [
				{
					down: [
						{
							actionId: 'reboot',
						},
					],
					up: [],
				},
			],
		})

		// Layout presets
		for (let i = 0; i < self.CHOICES_LAYOUTS.length; i++) {
			let layoutItem = self.CHOICES_LAYOUTS[i]
			presets.push({
				category: 'Layout',
				type: 'button',
				name: `Set Layout: ${layoutItem.label}`,
				style: {
					text: layoutItem.label,
					size: '14',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'setLayout',
								options: {
									layout_id: layoutItem.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'layout',
						options: {
							layout_id: layoutItem.id,
						},
						style: {
							color: colorWhite,
							bgcolor: colorRed,
						},
					},
				],
			})
		}

		// Recording presets
		presets.push({
			category: 'Recording',
			type: 'button',
			name: 'Start All Recording',
			style: {
				text: 'Start\nRec',
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'startRecording',
						},
					],
					up: [],
				},
			],
		})

		presets.push({
			category: 'Recording',
			type: 'button',
			name: 'Stop All Recording',
			style: {
				text: 'Stop\nRec',
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'stopRecording',
						},
					],
					up: [],
				},
			],
		})

		presets.push({
			category: 'Recording',
			type: 'button',
			name: 'Toggle Recording',
			style: {
				text: 'Toggle\nRec',
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'toggleRecording',
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'recording',
					options: {
						compare: 'recording',
					},
					style: {
						color: colorWhite,
						bgcolor: colorRed,
					},
				},
			],
		})

		presets.push({
			category: 'Recording',
			type: 'button',
			name: 'Recording Status',
			style: {
				text: 'Rec:\n$(cuber1:recording)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [
				{
					feedbackId: 'recording',
					options: {
						compare: 'recording',
					},
					style: {
						color: colorWhite,
						bgcolor: colorRed,
					},
				},
			],
		})

		presets.push({
			category: 'Recording',
			type: 'button',
			name: 'Saving Status',
			style: {
				text: 'Save:\n$(cuber1:saving)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [
				{
					feedbackId: 'saving',
					style: {
						color: colorWhite,
						bgcolor: colorOrange,
					},
				},
			],
		})

		// Record mode presets
		for (let i = 0; i < self.CHOICES_RECORD_MODES.length; i++) {
			let modeItem = self.CHOICES_RECORD_MODES[i]
			presets.push({
				category: 'Recording Mode',
				type: 'button',
				name: `Set Mode: ${modeItem.label}`,
				style: {
					text: modeItem.label,
					size: '14',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'setRecordMode',
								options: {
									mode: modeItem.id,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'recordMode',
						options: {
							mode: modeItem.id,
						},
						style: {
							color: colorWhite,
							bgcolor: colorRed,
						},
					},
				],
			})
		}

		// Single channel recording presets
		for (let i = 0; i < 9; i++) {
			presets.push({
				category: 'Single Recording',
				type: 'button',
				name: `Start Recording: CH${i + 1}`,
				style: {
					text: `CH${i + 1}\nStart`,
					size: '14',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'startSingleRec',
								options: {
									position: i,
								},
							},
						],
						up: [],
					},
				],
			})

			presets.push({
				category: 'Single Recording',
				type: 'button',
				name: `Stop Recording: CH${i + 1}`,
				style: {
					text: `CH${i + 1}\nStop`,
					size: '14',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'stopSingleRec',
								options: {
									position: i,
								},
							},
						],
						up: [],
					},
				],
			})
		}

		// Source presets
		presets.push({
			category: 'Source',
			type: 'button',
			name: 'Refresh NDI Sources',
			style: {
				text: 'Refresh\nSources',
				size: '14',
				color: colorWhite,
				bgcolor: colorBlue,
			},
			steps: [
				{
					down: [
						{
							actionId: 'refreshSources',
						},
					],
					up: [],
				},
			],
		})

		presets.push({
			category: 'Source',
			type: 'button',
			name: 'Remove All Sources',
			style: {
				text: 'Clear\nAll',
				size: '14',
				color: colorWhite,
				bgcolor: colorRed,
			},
			steps: [
				{
					down: [
						{
							actionId: 'removeAllSources',
						},
					],
					up: [],
				},
			],
		})

		// Position info presets
		for (let i = 1; i <= 9; i++) {
			presets.push({
				category: 'Source Info',
				type: 'button',
				name: `Position ${i} Source Info`,
				style: {
					text: `CH${i}\n$(cuber1:source_${i}_name)`,
					size: 'auto',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [],
				feedbacks: [
					{
						feedbackId: 'sourceOnline',
						options: {
							position: i - 1,
							compare: 'online',
						},
						style: {
							color: colorWhite,
							bgcolor: colorGreen,
						},
					},
				],
			})
		}

		// Info presets
		presets.push({
			category: 'Info',
			type: 'button',
			name: 'Device Hostname',
			style: {
				text: 'Host:\n$(cuber1:hostname)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [],
		})

		presets.push({
			category: 'Info',
			type: 'button',
			name: 'Current Layout',
			style: {
				text: 'Layout:\n$(cuber1:layout)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [],
		})

		presets.push({
			category: 'Info',
			type: 'button',
			name: 'Product Type',
			style: {
				text: 'Product:\n$(cuber1:product)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [],
		})

		presets.push({
			category: 'Info',
			type: 'button',
			name: 'Firmware Version',
			style: {
				text: 'FW:\n$(cuber1:firmware_version)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [],
		})

		presets.push({
			category: 'Info',
			type: 'button',
			name: 'Record Mode',
			style: {
				text: 'Mode:\n$(cuber1:record_mode)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [],
		})

		presets.push({
			category: 'Info',
			type: 'button',
			name: 'CPU Usage',
			style: {
				text: 'CPU:\n$(cuber1:cpu_usage)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [],
		})

		self.setPresetDefinitions(presets)
	},
}