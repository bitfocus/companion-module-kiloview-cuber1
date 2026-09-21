// Kiloview CUBE R1
import { InstanceBase, InstanceStatus } from '@companion-module/base'
import upgrades from './upgrades.js'

import KiloviewCubeR1 from './cuber1.js'
import config from './config.js'

import actions from './actions.js'
import feedbacks from './feedbacks.js'
import variables from './variables.js'
import presets from './presets.js'

import api from './api.js'

import constants from './constants.js'

export default class KiloviewR1Instance extends InstanceBase {
	constructor(internal) {
		super(internal)

		Object.assign(this, {
			...config,
			...actions,
			...feedbacks,
			...variables,
			...presets,
			...api,
		})

		this.POLLINGRATE = constants.POLLINGRATE
		this.POLLINGRATE_MAX = constants.POLLINGRATE_MAX
		this.POLLINGRATE_RESOURCES = constants.POLLINGRATE_RESOURCES
		this.POLLINGRATE_RESOURCES_MAX = constants.POLLINGRATE_RESOURCES_MAX
		this.RECONNECT_TIME = constants.RECONNECT_TIME
		this.LOGOUT_TIMEOUT = constants.LOGOUT_TIMEOUT
		this.AUTH_RETRY_MAX = constants.AUTH_RETRY_MAX
		this.REQUEST_TIMEOUT_DEFAULT = constants.REQUEST_TIMEOUT_DEFAULT
		this.REQUEST_BODY_MAX_BYTES = constants.REQUEST_BODY_MAX_BYTES
		this.POLL_ERROR_WARNING_THRESHOLD = constants.POLL_ERROR_WARNING_THRESHOLD
		this.PROJECT_ID = constants.PROJECT_ID
		this.MAX_WINDOWS = constants.MAX_WINDOWS
		this.MIN_DISKS = constants.MIN_DISKS
		this.CHOICES_RECORD_MODE = constants.CHOICES_RECORD_MODE
		this.CHOICES_TRANSCODING = constants.CHOICES_TRANSCODING
		this.CHOICES_ON_OFF_TOGGLE = constants.CHOICES_ON_OFF_TOGGLE
		this.CHOICES_SCHEDULE_TARGET = constants.CHOICES_SCHEDULE_TARGET
		this.CHOICES_WINDOW_DISPLAY_TARGET = constants.CHOICES_WINDOW_DISPLAY_TARGET
		this.CHOICES_SHOW_HIDE_TOGGLE = constants.CHOICES_SHOW_HIDE_TOGGLE
		this.CHOICES_SHOW_HIDE = constants.CHOICES_SHOW_HIDE
		this.CHOICES_MUTE_MODE = constants.CHOICES_MUTE_MODE
		this.CHOICES_SHOWN_HIDDEN = constants.CHOICES_SHOWN_HIDDEN
		this.CHOICES_NTP_STATE = constants.CHOICES_NTP_STATE
		this.CHOICES_SPLIT_TYPE = constants.CHOICES_SPLIT_TYPE
		this.CHOICES_DISK_STATE = constants.CHOICES_DISK_STATE

		this.initInstanceState()
	}

	initInstanceState() {
		const choices = constants.createDefaultChoiceSets()

		this.STATE = constants.createDefaultState()
		this.CHOICES_SOURCES = choices.CHOICES_SOURCES
		this.CHOICES_DISKS = choices.CHOICES_DISKS
		this.CHOICES_LAYOUTS = this.buildLayoutChoices()
		this.CHOICES_WINDOWS = this.buildWindowChoices()

		this.DEVICE = undefined
		this.secrets = {}
		this.INTERVAL = null
		this.INTERVAL_RESOURCES = null
		this.RECONNECT_INTERVAL = null
		this.STATE_CHECK_IN_FLIGHT = false
		this.STATE_CHECK_PROMISE = null
		this.RESOURCES_CHECK_IN_FLIGHT = false
		this.RESOURCES_CHECK_PROMISE = null
		this.PRESET_WINDOW_COUNT = null
		this.CONNECTION_GENERATION = 0
		this.INIT_CONNECTION_PROMISE = null
		this.POLL_ERROR_COUNT = 0
		this.SESSION_ESTABLISHED = false
		this.AUTH_RETRY_COUNT = 0
		this._destroyed = false
	}

	getPassword() {
		return this.secrets?.password || ''
	}

	normalizeHost(host) {
		return KiloviewCubeR1.formatHostForUrl(host)
	}

	isValidHost(host) {
		return KiloviewCubeR1.isValidHost(host)
	}

	normalizeConfig(config) {
		const normalized = { ...config }

		if (normalized.host !== undefined && normalized.host !== null) {
			normalized.host = this.normalizeHost(String(normalized.host))
		}

		if (normalized.port !== undefined && normalized.port !== null && normalized.port !== '') {
			normalized.port = parseInt(normalized.port, 10)
			if (!Number.isFinite(normalized.port)) {
				normalized.port = normalized.protocol === 'https' ? 443 : 80
			}
		} else {
			normalized.port = normalized.protocol === 'https' ? 443 : 80
		}

		if (normalized.request_timeout !== undefined && normalized.request_timeout !== null) {
			const timeout = parseInt(normalized.request_timeout, 10)
			normalized.request_timeout = Number.isFinite(timeout) ? timeout : this.REQUEST_TIMEOUT_DEFAULT
		} else {
			normalized.request_timeout = this.REQUEST_TIMEOUT_DEFAULT
		}

		return normalized
	}

	async init(config, isFirstInit, secrets) {
		await this.configUpdated(config, secrets)
	}

	async destroy() {
		try {
			this._destroyed = true
			this.CONNECTION_GENERATION++
			this.stopIntervals()
			await this.INIT_CONNECTION_PROMISE
			await this.disposeDevice(this.DEVICE)
			this.DEVICE = null
			this.updateStatus(InstanceStatus.Disconnected)
		} catch (error) {
			this.log('error', 'destroy error: ' + error)
		}
	}

	async configUpdated(config, secrets) {
		this.config = this.normalizeConfig(config)
		if (secrets !== undefined) {
			this.secrets = secrets || {}
		}

		// An invalid host is handled inside initConnection() so the previous connection is torn
		// down the same way as for any other config change.

		// New credentials get no benefit of the doubt: a login failure after a config change is final.
		this.SESSION_ESTABLISHED = false
		this.AUTH_RETRY_COUNT = 0

		if (
			this.config.protocol === 'https' &&
			this.config.port === 80 &&
			config.port !== undefined &&
			parseInt(config.port, 10) === 80
		) {
			this.log('warn', 'HTTPS is selected but port 80 is configured. Consider using port 443 for HTTPS connections.')
		}

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		await this.initConnection()
	}
}

export const UpgradeScripts = upgrades
