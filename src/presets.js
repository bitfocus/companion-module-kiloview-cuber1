import { combineRgb } from '@companion-module/base'

export default {
	initPresets: function () {
		let self = this
		let presets = {}
		let structure = []

		const colorWhite = combineRgb(255, 255, 255)
		const colorBlack = combineRgb(0, 0, 0)
		const colorRed = combineRgb(255, 0, 0)
		const colorGreen = combineRgb(0, 255, 0)
		const colorBlue = combineRgb(0, 0, 255)
		const colorOrange = combineRgb(255, 165, 0)
		const colorDarkRed = combineRgb(128, 0, 0)

		const hasSources = self.STATE.sources.length > 0
		const disks = self.getDisks()
		const windowCount = self.getPresetWindowCount()

		const windowLabel = (position) => {
			const window = self.getWindow(position)
			return window?.name ? `${window.name}` : `Window ${position}`
		}

		// ------------------------------------------------------------------
		// General
		// ------------------------------------------------------------------

		presets.refresh_status = {
			type: 'simple',
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
							options: {},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets.sync_time = {
			type: 'simple',
			name: 'Synchronize Time Now',
			style: {
				text: 'Sync\nTime',
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'syncTime',
							options: {},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets.refresh_sources = {
			type: 'simple',
			name: 'Refresh Source Discovery',
			style: {
				text: 'Rescan\nSources',
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'refreshSources',
							options: {},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		structure.push({
			id: 'general',
			name: 'General',
			definitions: ['refresh_status', 'sync_time', 'refresh_sources'],
		})

		// ------------------------------------------------------------------
		// Recording
		// ------------------------------------------------------------------

		const recordingFeedback = {
			feedbackId: 'recordingActive',
			options: {},
			style: {
				color: colorWhite,
				bgcolor: colorRed,
			},
		}

		presets.record_start = {
			type: 'simple',
			name: 'Start Recording',
			style: {
				text: 'REC\nStart',
				size: '14',
				color: colorWhite,
				bgcolor: colorDarkRed,
			},
			steps: [
				{
					down: [
						{
							actionId: 'setRecording',
							options: { mode: 'start' },
						},
					],
					up: [],
				},
			],
			feedbacks: [recordingFeedback],
		}

		presets.record_stop = {
			type: 'simple',
			name: 'Stop Recording',
			style: {
				text: 'REC\nStop',
				size: '14',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'setRecording',
							options: { mode: 'stop' },
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets.record_toggle = {
			type: 'simple',
			name: 'Toggle Recording',
			style: {
				text: 'REC',
				size: '18',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [
				{
					down: [
						{
							actionId: 'setRecording',
							options: { mode: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [recordingFeedback],
		}

		presets.record_status = {
			type: 'simple',
			name: 'Recording Status',
			style: {
				text: 'REC\n$(kiloview-cuber1:recording_duration)',
				size: 'auto',
				color: colorWhite,
				bgcolor: colorBlack,
			},
			steps: [],
			feedbacks: [recordingFeedback],
		}

		const recordingPresetIds = ['record_start', 'record_stop', 'record_toggle', 'record_status']

		for (const transcoding of self.CHOICES_TRANSCODING) {
			const presetId = `transcoding_${transcoding.id}`

			presets[presetId] = {
				type: 'simple',
				name: `Transcoding: ${transcoding.label}`,
				style: {
					text: transcoding.label.replace(' (same as source)', ''),
					size: '14',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'setTranscoding',
								options: { solution: transcoding.id },
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'transcodingActive',
						options: { solution: transcoding.id },
						style: {
							color: colorWhite,
							bgcolor: colorGreen,
						},
					},
				],
			}

			recordingPresetIds.push(presetId)
		}

		structure.push({
			id: 'recording',
			name: 'Recording',
			definitions: recordingPresetIds,
		})

		// ------------------------------------------------------------------
		// Layout
		// ------------------------------------------------------------------

		const layoutPresetIds = []

		for (const layout of self.CHOICES_LAYOUTS) {
			const presetId = `layout_${layout.id}`

			presets[presetId] = {
				type: 'simple',
				name: `Layout: ${layout.label}`,
				style: {
					text: layout.label.replace(' (Single)', ''),
					size: '14',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'setLayout',
								options: { layout: layout.id },
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'layoutActive',
						options: { layout: layout.id },
						style: {
							color: colorWhite,
							bgcolor: colorRed,
						},
					},
				],
			}

			layoutPresetIds.push(presetId)
		}

		structure.push({
			id: 'layout',
			name: 'Layout',
			definitions: layoutPresetIds,
		})

		// ------------------------------------------------------------------
		// Info
		// ------------------------------------------------------------------

		const infoPresets = [
			{ id: 'info_hostname', name: 'Device Hostname', text: 'Host:\n$(kiloview-cuber1:hostname)' },
			{ id: 'info_version', name: 'Software Version', text: 'Version:\n$(kiloview-cuber1:software_version)' },
			{ id: 'info_ip', name: 'IP Address', text: 'IP:\n$(kiloview-cuber1:ip_address)' },
			{ id: 'info_cpu', name: 'CPU Usage', text: 'CPU:\n$(kiloview-cuber1:cpu)' },
			{ id: 'info_memory', name: 'Memory Usage', text: 'Mem:\n$(kiloview-cuber1:memory)' },
			{ id: 'info_temperature', name: 'CPU Temperature', text: 'Temp:\n$(kiloview-cuber1:temperature_c)' },
			{ id: 'info_sources', name: 'Discovered Source Count', text: 'Sources:\n$(kiloview-cuber1:source_count)' },
		]

		for (const infoPreset of infoPresets) {
			presets[infoPreset.id] = {
				type: 'simple',
				name: infoPreset.name,
				style: {
					text: infoPreset.text,
					size: 'auto',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [],
				feedbacks: [],
			}
		}

		structure.push({
			id: 'info',
			name: 'Info',
			definitions: infoPresets.map((infoPreset) => infoPreset.id),
		})

		// ------------------------------------------------------------------
		// Window sources: one group per window, with a button per discovered source
		// ------------------------------------------------------------------

		if (hasSources) {
			const sourceGroups = []

			for (let position = 1; position <= windowCount; position++) {
				const groupPresets = []

				for (const source of self.STATE.sources) {
					const presetId = `window_${position}_source_${source.id}`

					presets[presetId] = {
						type: 'simple',
						name: `Set ${source.name} on ${windowLabel(position)}`,
						style: {
							text: source.name,
							size: 'auto',
							color: colorWhite,
							bgcolor: colorBlack,
						},
						steps: [
							{
								down: [
									{
										actionId: 'setWindowSource',
										options: {
											window: position,
											source: source.id,
										},
									},
								],
								up: [],
							},
						],
						feedbacks: [
							{
								feedbackId: 'windowSource',
								options: {
									window: position,
									source: source.id,
								},
								style: {
									color: colorWhite,
									bgcolor: colorRed,
								},
							},
						],
					}

					groupPresets.push(presetId)
				}

				const removeId = `window_${position}_remove`

				presets[removeId] = {
					type: 'simple',
					name: `Remove Source from ${windowLabel(position)}`,
					style: {
						text: 'Remove\nSource',
						size: '14',
						color: colorWhite,
						bgcolor: colorBlack,
					},
					steps: [
						{
							down: [
								{
									actionId: 'removeWindowSource',
									options: {
										window: position,
									},
								},
							],
							up: [],
						},
					],
					feedbacks: [
						{
							feedbackId: 'windowEmpty',
							options: {
								window: position,
							},
							style: {
								color: colorWhite,
								bgcolor: colorOrange,
							},
						},
					],
				}

				groupPresets.push(removeId)

				sourceGroups.push({
					id: `window_sources_${position}`,
					type: 'simple',
					name: `Sources for ${windowLabel(position)}`,
					presets: groupPresets,
				})
			}

			structure.push({
				id: 'window_sources',
				name: 'Window Sources',
				definitions: sourceGroups,
			})
		}

		// ------------------------------------------------------------------
		// Windows: mute toggles and current state
		// ------------------------------------------------------------------

		const mutePresetIds = []
		const statusPresetIds = []
		const videoPresetIds = []

		for (let position = 1; position <= windowCount; position++) {
			const muteId = `window_${position}_mute`

			presets[muteId] = {
				type: 'simple',
				name: `Toggle Audio: ${windowLabel(position)}`,
				style: {
					text: `Audio\n${windowLabel(position)}`,
					size: 'auto',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'setWindowMute',
								options: {
									window: position,
									mode: 'toggle',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'windowMuted',
						options: {
							window: position,
						},
						style: {
							color: colorWhite,
							bgcolor: colorRed,
						},
					},
				],
			}

			mutePresetIds.push(muteId)

			const videoId = `window_${position}_video`

			presets[videoId] = {
				type: 'simple',
				name: `Toggle Video: ${windowLabel(position)}`,
				style: {
					text: `Video\n${windowLabel(position)}`,
					size: 'auto',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'setWindowDisplay',
								options: {
									window: position,
									target: 'video',
									mode: 'toggle',
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'windowDisplay',
						options: {
							window: position,
							target: 'video',
							state: 'hidden',
						},
						style: {
							color: colorWhite,
							bgcolor: colorOrange,
						},
					},
				],
			}

			videoPresetIds.push(videoId)

			const statusId = `window_${position}_status`

			presets[statusId] = {
				type: 'simple',
				name: `Current Source: ${windowLabel(position)}`,
				style: {
					text: `$(kiloview-cuber1:window_${position}_name)\n$(kiloview-cuber1:window_${position}_source)`,
					size: 'auto',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [],
				feedbacks: [
					{
						feedbackId: 'windowEmpty',
						options: {
							window: position,
						},
						style: {
							color: colorWhite,
							bgcolor: colorOrange,
						},
					},
				],
			}

			statusPresetIds.push(statusId)
		}

		structure.push({
			id: 'windows',
			name: 'Windows',
			definitions: [
				{
					id: 'window_audio',
					type: 'simple',
					name: 'Window Audio',
					presets: mutePresetIds,
				},
				{
					id: 'window_video',
					type: 'simple',
					name: 'Window Video',
					presets: videoPresetIds,
				},
				{
					id: 'window_status',
					type: 'simple',
					name: 'Window Status',
					presets: statusPresetIds,
				},
			],
		})

		// ------------------------------------------------------------------
		// Storage
		// ------------------------------------------------------------------

		const diskStatusIds = []
		const startDiskIds = []

		for (let idx = 1; idx <= Math.max(self.MIN_DISKS, disks.length); idx++) {
			const disk = disks[idx - 1]
			const diskId = disk !== undefined ? String(disk.id) : String(idx - 1)
			const diskName = disk?.name || `Disk ${idx}`

			const statusId = `disk_${idx}_status`

			presets[statusId] = {
				type: 'simple',
				name: `Disk Status: ${diskName}`,
				style: {
					text: `$(kiloview-cuber1:disk_${idx}_name)\n$(kiloview-cuber1:disk_${idx}_used) / $(kiloview-cuber1:disk_${idx}_total)`,
					size: 'auto',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [],
				feedbacks: [
					{
						feedbackId: 'diskState',
						options: {
							disk: diskId,
							state: 'online',
						},
						style: {
							color: colorWhite,
							bgcolor: colorGreen,
						},
					},
					{
						feedbackId: 'diskState',
						options: {
							disk: diskId,
							state: 'recording',
						},
						style: {
							color: colorWhite,
							bgcolor: colorRed,
						},
					},
				],
			}

			diskStatusIds.push(statusId)

			const startId = `disk_${idx}_start`

			presets[startId] = {
				type: 'simple',
				name: `Set Start Disk: ${diskName}`,
				style: {
					text: `Start Disk\n${diskName}`,
					size: 'auto',
					color: colorWhite,
					bgcolor: colorBlack,
				},
				steps: [
					{
						down: [
							{
								actionId: 'setStartDisk',
								options: {
									disk: diskId,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'startDisk',
						options: {
							disk: diskId,
						},
						style: {
							color: colorWhite,
							bgcolor: colorGreen,
						},
					},
				],
			}

			startDiskIds.push(startId)
		}

		structure.push({
			id: 'storage',
			name: 'Storage',
			definitions: [
				{
					id: 'disk_status',
					type: 'simple',
					name: 'Disk Status',
					presets: diskStatusIds,
				},
				{
					id: 'start_disk',
					type: 'simple',
					name: 'Start Disk',
					presets: startDiskIds,
				},
			],
		})

		self.setPresetDefinitions(structure, presets)
	},
}
