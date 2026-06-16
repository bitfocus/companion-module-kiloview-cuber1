module.exports = {
	POLLINGRATE: 1000,
	POLLINGRATE_SOURCES: 10000,
	RECONNECT_TIME: 30000,
	DEVICE: undefined,

	CHOICES_SOURCES: [{ id: 'null', url: '', label: '- No sources available -' }],

	STATE: {
		mode: 'N/A',
		layout_id: 1,
		recording: false,
		saving: false,
		record_mode: 'N/A',
	},

	CHOICES_LAYOUTS: [
		{ id: 1, label: '1 Split (Single)' },
		{ id: 2, label: '4 Split' },
		{ id: 3, label: '9 Split' },
	],

	CHOICES_POSITIONS_1: [{ id: 0, label: 'Position 1' }],

	CHOICES_POSITIONS_4: [
		{ id: 0, label: 'Position 1' },
		{ id: 1, label: 'Position 2' },
		{ id: 2, label: 'Position 3' },
		{ id: 3, label: 'Position 4' },
	],

	CHOICES_POSITIONS_9: [
		{ id: 0, label: 'Position 1' },
		{ id: 1, label: 'Position 2' },
		{ id: 2, label: 'Position 3' },
		{ id: 3, label: 'Position 4' },
		{ id: 4, label: 'Position 5' },
		{ id: 5, label: 'Position 6' },
		{ id: 6, label: 'Position 7' },
		{ id: 7, label: 'Position 8' },
		{ id: 8, label: 'Position 9' },
	],

	CHOICES_RECORD_MODES: [
		{ id: 0, label: 'Record Mode' },
		{ id: 1, label: 'Director Mode' },
	],

	CHOICES_SOURCE_TYPE: [
		{ id: 0, label: 'NDI Discovery' },
		{ id: 1, label: 'Manual IP' },
	],

	CHOICES_RECORD_FORMAT: [
		{ id: 'mov', label: 'MOV' },
		{ id: 'mp4', label: 'MP4' },
	],

	CHOICES_SOURCE_LIST_SORTING: [
		{ id: 0, label: 'Default' },
		{ id: 1, label: 'By Name' },
		{ id: 2, label: 'By IP' },
	],

	CHOICES_DISK: [
		{ id: 'ssd1', label: 'SSD1' },
		{ id: 'ssd2', label: 'SSD2' },
	],

	CHOICES_NAS_TYPE: [
		{ id: 0, label: 'SMB' },
		{ id: 1, label: 'NFS' },
	],

	CHOICES_LIMIT_TYPE: [
		{ id: 0, label: 'No Limit' },
		{ id: 1, label: 'Time Limit' },
		{ id: 2, label: 'Size Limit' },
	],

	CHOICES_RECORD_MODE_TYPE: [
		{ id: 0, label: 'Local' },
		{ id: 1, label: 'Backup' },
		{ id: 2, label: 'Dual' },
		{ id: 3, label: 'NAS' },
	],

	INTERVAL: null,
	INTERVAL_SOURCES: null,
	RECONNECT_INTERVAL: null,
}