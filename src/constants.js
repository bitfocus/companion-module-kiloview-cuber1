const PLACEHOLDER_SOURCE = { id: 0, label: '- No sources discovered -' }
const PLACEHOLDER_DISK = { id: 0, label: '- No disks available -' }

// The R1 API reserves project_id and documents it as "always 1".
const PROJECT_ID = 1

// The device ships 1 / 4 / 9 split layouts. The real list is read from /layout/icon.json once
// connected; these are the defaults offered while the device is unreachable so buttons can be
// configured offline.
const DEFAULT_LAYOUTS = [
	{ id: 1, number: 1 },
	{ id: 2, number: 4 },
	{ id: 3, number: 9 },
]

// Largest documented multiview grid. The window count actually offered grows if the device
// reports a bigger layout.
const MAX_WINDOWS = 9

// The device has two SSD bays. Disk variables are always defined for at least this many so
// presets referencing DISK2 resolve before the first storage poll.
const MIN_DISKS = 2

function createDefaultState() {
	return {
		layouts: DEFAULT_LAYOUTS.map((layout) => ({ ...layout })),
		layouts_from_device: false,
		layout_id: null,
		layout_number: null,
		windows: [],
		sources: [],
		recording: false,
		record_start_time: null,
		record_msg: '',
		record_info: null,
		storage: null,
		performance: null,
		network: [],
		hostname: '',
		software_version: '',
		firmware_version: '',
	}
}

function createDefaultChoiceSets() {
	return {
		CHOICES_SOURCES: [{ ...PLACEHOLDER_SOURCE }],
		CHOICES_DISKS: [{ ...PLACEHOLDER_DISK }],
	}
}

export default {
	POLLINGRATE: 1000,
	POLLINGRATE_MAX: 60000,
	POLLINGRATE_RESOURCES: 10000,
	POLLINGRATE_RESOURCES_MAX: 600000,
	RECONNECT_TIME: 30000,
	LOGOUT_TIMEOUT: 1500,
	AUTH_RETRY_MAX: 3,
	REQUEST_TIMEOUT_DEFAULT: 5000,
	REQUEST_BODY_MAX_BYTES: 10 * 1024 * 1024,
	POLL_ERROR_WARNING_THRESHOLD: 3,
	PROJECT_ID,
	DEFAULT_LAYOUTS,
	MAX_WINDOWS,
	MIN_DISKS,
	PLACEHOLDER_SOURCE,
	PLACEHOLDER_DISK,
	createDefaultState,
	createDefaultChoiceSets,

	CHOICES_RECORD_MODE: [
		{ id: 'start', label: 'Start Recording' },
		{ id: 'stop', label: 'Stop Recording' },
		{ id: 'toggle', label: 'Toggle Recording' },
	],

	CHOICES_TRANSCODING: [
		{ id: 0, label: 'Native (same as source)' },
		{ id: 1, label: 'H.264' },
		{ id: 2, label: 'H.265' },
	],

	CHOICES_ON_OFF_TOGGLE: [
		{ id: 'on', label: 'On' },
		{ id: 'off', label: 'Off' },
		{ id: 'toggle', label: 'Toggle' },
	],

	CHOICES_SCHEDULE_TARGET: [
		{ id: 'start', label: 'Scheduled Start' },
		{ id: 'stop', label: 'Scheduled Stop' },
	],

	CHOICES_WINDOW_DISPLAY_TARGET: [
		{ id: 'video', label: 'Video' },
		{ id: 'audio', label: 'Audio Meter' },
		{ id: 'both', label: 'Video and Audio Meter' },
	],

	CHOICES_SHOW_HIDE_TOGGLE: [
		{ id: 'show', label: 'Show' },
		{ id: 'hide', label: 'Hide' },
		{ id: 'toggle', label: 'Toggle' },
	],

	CHOICES_SHOW_HIDE: [
		{ id: 'show', label: 'Show' },
		{ id: 'hide', label: 'Hide' },
	],

	CHOICES_MUTE_MODE: [
		{ id: 'mute', label: 'Mute' },
		{ id: 'unmute', label: 'Unmute' },
		{ id: 'toggle', label: 'Toggle' },
	],

	CHOICES_SHOWN_HIDDEN: [
		{ id: 'shown', label: 'Shown' },
		{ id: 'hidden', label: 'Hidden' },
	],

	CHOICES_NTP_STATE: [
		{ id: 'sync', label: 'Synchronized' },
		{ id: 'unsync', label: 'Not Synchronized' },
		{ id: 'error', label: 'Synchronization Error' },
	],

	CHOICES_SPLIT_TYPE: [
		{ id: 'size', label: 'By File Size' },
		{ id: 'time', label: 'By Duration' },
	],

	CHOICES_DISK_STATE: [
		{ id: 'online', label: 'Online' },
		{ id: 'offline', label: 'Offline' },
		{ id: 'unlocked', label: 'Unlocked' },
		{ id: 'locked', label: 'Locked' },
		{ id: 'recording', label: 'Recording' },
	],
}
