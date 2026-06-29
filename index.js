// Kiloview CUBE R1
const { InstanceBase, InstanceStatus, runEntrypoint } = require('@companion-module/base')
const upgrades = require('./src/upgrades')

const config = require('./src/config')

const actions = require('./src/actions')
const feedbacks = require('./src/feedbacks')
const variables = require('./src/variables')
const presets = require('./src/presets')

const api = require('./src/api')

const constants = require('./src/constants')

class cuber1Instance extends InstanceBase {
	constructor(internal) {
		super(internal)

		// Assign the methods from the listed files to this class
		Object.assign(this, {
			...config,

			...actions,
			...feedbacks,
			...variables,
			...presets,

			...api,

			...constants,
		})

		this.resetRuntimeState()
	}

	async init(config) {
		this.configUpdated(config)
	}

	async destroy() {
		try {
			clearInterval(this.INTERVAL)
			clearInterval(this.INTERVAL_SOURCES)
			clearTimeout(this.RECONNECT_INTERVAL)
		} catch (error) {
			this.log('error', 'destroy error:' + error)
		}
	}

	resetRuntimeState() {
		this.DEVICE = undefined
		this.CHOICES_SOURCES = constants.createInitialSourceChoices()
		this.STATE = constants.createInitialState()
		this.INTERVAL = null
		this.INTERVAL_SOURCES = null
		this.RECONNECT_INTERVAL = null
	}

	async configUpdated(config) {
		clearInterval(this.INTERVAL)
		clearInterval(this.INTERVAL_SOURCES)
		clearTimeout(this.RECONNECT_INTERVAL)

		this.resetRuntimeState()

		this.config = config

		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		this.initConnection()
	}
}

runEntrypoint(cuber1Instance, upgrades)
