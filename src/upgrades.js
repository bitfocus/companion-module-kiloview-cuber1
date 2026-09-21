export default [
	// The pre-release module stored the device password as a plain config field. Move it into
	// secrets so it is no longer exported in clear text with the connection config.
	function migratePasswordToSecrets(_context, props) {
		const result = {
			updatedConfig: null,
			updatedSecrets: null,
			updatedActions: [],
			updatedFeedbacks: [],
		}

		if (!props.config?.password) {
			return result
		}

		result.updatedConfig = { ...props.config }
		delete result.updatedConfig.password

		result.updatedSecrets = {
			...(props.secrets || {}),
			password: props.config.password,
		}

		return result
	},
]
