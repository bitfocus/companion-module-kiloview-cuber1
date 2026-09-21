export default {
	initActions: function () {
		let self = this
		let actions = {}

		const sourceChoicesWithNone = [{ id: 'none', label: '- None (Remove Source) -' }, ...self.CHOICES_SOURCES]

		const runAction = async (description, fn, action = null, includeResources = false) => {
			if (!self.DEVICE) {
				self.log('error', `Action "${description}" skipped: not connected to device.`)
				return
			}

			const options = action?.options
			if (options) {
				for (const key of ['source', 'disk']) {
					if (options[key] === undefined) {
						continue
					}
					if (key === 'source' && options[key] === 'none') {
						continue
					}
					if (self.isPlaceholderChoiceId(options[key])) {
						self.log('error', `Action "${description}" skipped: no valid ${key} selected.`)
						return
					}
				}
			}

			try {
				await fn()
				await self.refreshStateAfterAction(includeResources)
			} catch (error) {
				await self.handleRequestError(error, `Action "${description}" failed`)
			}
		}

		const windowOption = {
			type: 'dropdown',
			label: 'Window',
			id: 'window',
			default: self.CHOICES_WINDOWS[0].id,
			choices: self.CHOICES_WINDOWS,
		}

		// /record/setinfo.json replaces the whole settings object, so every change is merged over
		// the last values read from the device.
		const buildRecordInfo = (changes) => {
			const current = self.STATE.record_info
			if (!current) {
				self.log('error', 'Recording settings have not been read from the device yet; try again after the next poll.')
				return null
			}

			return {
				solution: current.solution ?? 0,
				sync: current.sync === true,
				isStart: current.isStart === true,
				startTime: current.startTime ?? '',
				isStop: current.isStop === true,
				stopTime: current.stopTime ?? '',
				...changes,
			}
		}

		// ------------------------------------------------------------------
		// Recording
		// ------------------------------------------------------------------

		actions.setRecording = {
			name: 'Recording: Start / Stop Recording',
			description: 'Starts or stops recording of all windows in the current layout',
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_RECORD_MODE[0].id,
					choices: self.CHOICES_RECORD_MODE,
				},
			],
			callback: async function (action) {
				let options = action.options

				let record = options.mode === 'start'
				if (options.mode === 'toggle') {
					record = !(self.STATE.recording === true)
				}

				await runAction(
					record ? 'Start Recording' : 'Stop Recording',
					() => self.DEVICE.setRecordStatus(record),
					action,
				)
			},
		}

		actions.setTranscoding = {
			name: 'Recording: Set Transcoding Method',
			description: 'Sets the encoding used for recorded files (takes effect on the next recording)',
			options: [
				{
					type: 'dropdown',
					label: 'Transcoding',
					id: 'solution',
					default: self.CHOICES_TRANSCODING[0].id,
					choices: self.CHOICES_TRANSCODING,
				},
			],
			callback: async function (action) {
				let options = action.options
				const info = buildRecordInfo({ solution: parseInt(options.solution) })
				if (!info) {
					return
				}

				await runAction('Set Transcoding Method', () => self.DEVICE.setRecordInfo(info), action, true)
			},
		}

		actions.setForceTimeSync = {
			name: 'Recording: Set Forced Time Synchronization',
			options: [
				{
					type: 'dropdown',
					label: 'Forced Time Sync',
					id: 'mode',
					default: self.CHOICES_ON_OFF_TOGGLE[0].id,
					choices: self.CHOICES_ON_OFF_TOGGLE,
				},
			],
			callback: async function (action) {
				let options = action.options

				let sync = options.mode === 'on'
				if (options.mode === 'toggle') {
					sync = !(self.STATE.record_info?.sync === true)
				}

				const info = buildRecordInfo({ sync })
				if (!info) {
					return
				}

				await runAction('Set Forced Time Synchronization', () => self.DEVICE.setRecordInfo(info), action, true)
			},
		}

		actions.setScheduledRecording = {
			name: 'Recording: Set Scheduled Start / Stop',
			description: 'Enables or disables a scheduled recording start or stop time',
			options: [
				{
					type: 'dropdown',
					label: 'Schedule',
					id: 'target',
					default: self.CHOICES_SCHEDULE_TARGET[0].id,
					choices: self.CHOICES_SCHEDULE_TARGET,
				},
				{
					type: 'checkbox',
					label: 'Enabled',
					id: 'enabled',
					default: true,
				},
				{
					type: 'textinput',
					label: 'Time (YYYY-MM-DD HH:MM:SS)',
					id: 'time',
					default: '',
					useVariables: true,
					isVisibleExpression: '!!$(options:enabled)',
				},
			],
			callback: async function (action) {
				let options = action.options
				const enabled = options.enabled === true
				const time = String(options.time ?? '').trim()

				if (enabled && !/^\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{2}:\d{2}$/.test(time)) {
					self.log('error', `Scheduled recording time "${time}" is not in the form YYYY-MM-DD HH:MM:SS.`)
					return
				}

				const changes =
					options.target === 'stop'
						? { isStop: enabled, stopTime: enabled ? time : (self.STATE.record_info?.stopTime ?? '') }
						: { isStart: enabled, startTime: enabled ? time : (self.STATE.record_info?.startTime ?? '') }

				const info = buildRecordInfo(changes)
				if (!info) {
					return
				}

				await runAction('Set Scheduled Recording', () => self.DEVICE.setRecordInfo(info), action, true)
			},
		}

		// ------------------------------------------------------------------
		// Layout
		// ------------------------------------------------------------------

		actions.setLayout = {
			name: 'Layout: Set Layout',
			description: 'Switches the multiview between the 1 / 4 / 9 split layouts',
			options: [
				{
					type: 'dropdown',
					label: 'Layout',
					id: 'layout',
					default: self.CHOICES_LAYOUTS[0].id,
					choices: self.CHOICES_LAYOUTS,
				},
			],
			callback: async function (action) {
				let options = action.options
				const layout = self.getLayoutById(options.layout)

				if (!layout) {
					self.log('error', `Layout ${options.layout} is not available on the device.`)
					return
				}

				await runAction('Set Layout', () => self.DEVICE.setLayout(self.PROJECT_ID, layout.id, layout.number), action)
			},
		}

		// ------------------------------------------------------------------
		// Windows
		// ------------------------------------------------------------------

		actions.setWindowSource = {
			name: 'Window: Set Source for Window',
			description: 'Assigns a discovered NDI source to a window of the current layout',
			options: [
				windowOption,
				{
					type: 'dropdown',
					label: 'NDI Source',
					id: 'source',
					default: sourceChoicesWithNone[0].id,
					choices: sourceChoicesWithNone,
				},
			],
			callback: async function (action) {
				let options = action.options
				const position = parseInt(options.window)

				if (options.source === 'none') {
					await runAction(
						'Remove Source from Window',
						() => self.DEVICE.removeWindowSource(self.PROJECT_ID, position),
						action,
					)
					return
				}

				await runAction(
					'Set Source for Window',
					() =>
						self.DEVICE.setWindowSource(
							self.PROJECT_ID,
							position,
							String(options.source),
							self.getSourceById(options.source) ?? {},
						),
					action,
				)
			},
		}

		actions.removeWindowSource = {
			name: 'Window: Remove Source from Window',
			options: [windowOption],
			callback: async function (action) {
				let options = action.options
				await runAction(
					'Remove Source from Window',
					() => self.DEVICE.removeWindowSource(self.PROJECT_ID, parseInt(options.window)),
					action,
				)
			},
		}

		actions.clearAllWindows = {
			name: 'Window: Remove Sources from All Windows',
			options: [],
			callback: async function () {
				await runAction('Remove Sources from All Windows', () => self.DEVICE.clearAllWindows(self.PROJECT_ID))
			},
		}

		actions.setWindowName = {
			name: 'Window: Set Window Name',
			options: [
				windowOption,
				{
					type: 'textinput',
					label: 'Name',
					id: 'name',
					default: '',
					useVariables: true,
				},
			],
			callback: async function (action) {
				let options = action.options
				const name = String(options.name ?? '')

				await runAction(
					'Set Window Name',
					() => self.DEVICE.setWindowName(self.PROJECT_ID, parseInt(options.window), name),
					action,
				)
			},
		}

		actions.setWindowDisplay = {
			name: 'Window: Show / Hide Window Video / Audio Meter',
			description: 'Controls whether the video and the audio meter of a window are displayed on the multiview',
			options: [
				windowOption,
				{
					type: 'dropdown',
					label: 'Target',
					id: 'target',
					default: self.CHOICES_WINDOW_DISPLAY_TARGET[0].id,
					choices: self.CHOICES_WINDOW_DISPLAY_TARGET,
				},
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_SHOW_HIDE_TOGGLE[0].id,
					choices: self.CHOICES_SHOW_HIDE_TOGGLE,
				},
			],
			callback: async function (action) {
				let options = action.options
				const position = parseInt(options.window)
				const window = self.getWindow(position)

				const resolve = (current) => {
					if (options.mode === 'show') {
						return true
					}
					if (options.mode === 'hide') {
						return false
					}
					return !(current === true)
				}

				let showVideo = window?.showVideo === true
				let showVolume = window?.showVolume === true

				if (options.target === 'video' || options.target === 'both') {
					showVideo = resolve(window?.showVideo)
				}
				if (options.target === 'audio' || options.target === 'both') {
					showVolume = resolve(window?.showVolume)
				}

				const showAll = showVideo && showVolume

				await runAction(
					'Show / Hide Window Video / Audio Meter',
					() => self.DEVICE.setWindowEnable(self.PROJECT_ID, position, showAll, showVolume, showVideo),
					action,
				)
			},
		}

		actions.setWindowMute = {
			name: 'Window: Mute / Unmute Window Audio',
			options: [
				windowOption,
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_MUTE_MODE[0].id,
					choices: self.CHOICES_MUTE_MODE,
				},
			],
			callback: async function (action) {
				let options = action.options
				const position = parseInt(options.window)

				let audioOn = options.mode === 'unmute'
				if (options.mode === 'toggle') {
					const window = self.getWindow(position)
					audioOn = !(window?.volume === 'on')
				}

				await runAction(
					'Mute / Unmute Window Audio',
					() => self.DEVICE.setWindowAudio(self.PROJECT_ID, position, audioOn),
					action,
				)
			},
		}

		actions.setGlobalVisible = {
			name: 'Window: Show / Hide All Windows',
			description: 'Shows or hides the video of every window in the current layout',
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: self.CHOICES_SHOW_HIDE[0].id,
					choices: self.CHOICES_SHOW_HIDE,
				},
			],
			callback: async function (action) {
				let options = action.options
				await runAction(
					'Show / Hide All Windows',
					() => self.DEVICE.setGlobalVisible(self.PROJECT_ID, options.mode === 'show'),
					action,
				)
			},
		}

		// ------------------------------------------------------------------
		// Sources
		// ------------------------------------------------------------------

		actions.refreshSources = {
			name: 'Sources: Refresh Source Discovery',
			description: 'Asks the device to rescan the network for NDI sources and reloads the source list',
			options: [],
			callback: async function () {
				await runAction('Refresh Source Discovery', () => self.DEVICE.refreshSources(), null, true)
			},
		}

		// ------------------------------------------------------------------
		// Storage
		// ------------------------------------------------------------------

		const withStorage = (description) => {
			const storage = self.STATE.storage
			if (!storage) {
				self.log('error', `Action "${description}" skipped: storage settings have not been read from the device yet.`)
				return null
			}
			return storage
		}

		// The API guide's request example sends `choose` as a number while the device reports it as
		// a string; send it back in whichever type the device itself used.
		const diskIdForDevice = (storage, disk_id) => {
			return typeof storage.choose === 'number' ? parseInt(disk_id) : String(disk_id)
		}

		actions.setStartDisk = {
			name: 'Storage: Set Start Disk',
			description: 'Selects the disk that new recordings are written to first',
			options: [
				{
					type: 'dropdown',
					label: 'Disk',
					id: 'disk',
					default: self.CHOICES_DISKS[0].id,
					choices: self.CHOICES_DISKS,
				},
			],
			callback: async function (action) {
				let options = action.options
				const storage = withStorage('Set Start Disk')
				if (!storage) {
					return
				}

				await runAction(
					'Set Start Disk',
					() =>
						self.DEVICE.setStorageLimit(
							diskIdForDevice(storage, options.disk),
							storage.limitType ?? 'size',
							parseInt(storage.limitSize) || 0,
							parseInt(storage.limitTime) || 0,
						),
					action,
					true,
				)
			},
		}

		actions.setFileSplit = {
			name: 'Storage: Set Recording File Split Rule',
			description: 'Sets whether recordings are split into files by size or by duration',
			options: [
				{
					type: 'dropdown',
					label: 'Split Files',
					id: 'limitType',
					default: self.CHOICES_SPLIT_TYPE[0].id,
					choices: self.CHOICES_SPLIT_TYPE,
				},
				{
					type: 'number',
					label: 'File Size Limit (GB)',
					id: 'limitSize',
					default: 10,
					min: 1,
					max: 10000,
					isVisibleExpression: '$(options:limitType) === "size"',
				},
				{
					type: 'number',
					label: 'Duration Limit (minutes)',
					id: 'limitTime',
					default: 60,
					min: 1,
					max: 100000,
					isVisibleExpression: '$(options:limitType) === "time"',
				},
			],
			callback: async function (action) {
				let options = action.options
				const storage = withStorage('Set Recording File Split Rule')
				if (!storage) {
					return
				}

				const limitSize = options.limitType === 'size' ? parseInt(options.limitSize) : parseInt(storage.limitSize) || 0
				const limitTime = options.limitType === 'time' ? parseInt(options.limitTime) : parseInt(storage.limitTime) || 0

				if (!Number.isFinite(limitSize) || !Number.isFinite(limitTime)) {
					self.log('error', 'Set Recording File Split Rule: the limit value must be a number.')
					return
				}

				await runAction(
					'Set Recording File Split Rule',
					() =>
						self.DEVICE.setStorageLimit(
							diskIdForDevice(storage, storage.choose ?? '0'),
							options.limitType,
							limitSize,
							limitTime,
						),
					action,
					true,
				)
			},
		}

		// ------------------------------------------------------------------
		// System
		// ------------------------------------------------------------------

		actions.setHostname = {
			name: 'System: Set Hostname',
			options: [
				{
					type: 'textinput',
					label: 'Hostname',
					id: 'hostname',
					default: '',
					useVariables: true,
				},
			],
			callback: async function (action) {
				const hostname = String(action.options.hostname ?? '').trim()

				if (!hostname) {
					self.log('error', 'Cannot set hostname: no hostname given.')
					return
				}

				await runAction('Set Hostname', () => self.DEVICE.setHostname(hostname), action, true)
			},
		}

		actions.syncTime = {
			name: 'System: Synchronize Time Now',
			description: 'Triggers a one-off time synchronization using the configured method',
			options: [],
			callback: async function () {
				await runAction('Synchronize Time Now', () => self.DEVICE.applyTimeSync(self.PROJECT_ID))
			},
		}

		actions.refreshStatus = {
			name: 'System: Refresh Device Status',
			options: [],
			callback: async function () {
				if (!self.DEVICE) {
					self.log('error', 'Refresh skipped: not connected to device.')
					return
				}

				await self.refreshStateAfterAction(true)
			},
		}

		self.setActionDefinitions(actions)
	},
}
