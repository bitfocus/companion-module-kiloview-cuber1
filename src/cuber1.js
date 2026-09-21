import http from 'node:http'
import https from 'node:https'
import { isIP } from 'node:net'

/**
 * HTTP API client for the Kiloview CUBE R1 multi-channel NDI recorder.
 *
 * Every endpoint lives under /api/r1/<module>/<function>.json and answers
 * `{ result: 'ok', data?: ... }` or `{ result: 'error', msg?, reason? }`.
 */
class KiloviewCubeR1 {
	constructor(owner, ip, username, password, protocol = 'http', port = 80, options = {}) {
		this.owner = owner
		this.connection_info = {
			ip,
			username,
			password,
			protocol,
			port,
		}

		this.rejectUnauthorized = options.rejectUnauthorized === true
		this.requestTimeout = options.requestTimeout || 5000
		this.maxBodyBytes = options.maxBodyBytes || 10 * 1024 * 1024

		const hostForUrl = KiloviewCubeR1.formatHostForUrl(ip)
		this.baseURL = `${protocol}://${hostForUrl}:${port}/api/r1`

		const agentOpts = {
			keepAlive: true,
			keepAliveMsecs: 30000,
			maxSockets: 5,
		}

		this.httpAgent = new http.Agent(agentOpts)
		this.httpsAgent = new https.Agent({
			...agentOpts,
			rejectUnauthorized: this.rejectUnauthorized,
		})

		this.token = ''
		this.tokenUsername = ''
		this.authorized = false
		this._closed = false
		this._activeRequests = new Set()
		this._authMutex = null
	}

	async _withAuthMutex(fn) {
		const previous = this._authMutex || Promise.resolve()
		let release
		const gate = new Promise((resolve) => {
			release = resolve
		})
		this._authMutex = gate
		await previous
		try {
			return await fn()
		} finally {
			release()
		}
	}

	log(level, message) {
		this.owner.log(level, message)
	}

	static formatHostForUrl(host) {
		const trimmed = String(host).trim()
		if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
			return trimmed
		}

		if (/^[0-9a-fA-F:]+$/.test(trimmed) && trimmed.includes(':')) {
			return `[${trimmed}]`
		}

		return trimmed
	}

	/**
	 * Validates a configured host. Accepts IPv4, IPv6 (bare or bracketed) and DNS hostnames.
	 *
	 * Note: do not use `Regex.IP` / `Regex.HOSTNAME` from @companion-module/base here. Those are
	 * `/pattern/`-delimited *strings* meant for the `regex` property of config input fields, not
	 * RegExp objects, so calling `.test()` on them throws.
	 */
	static isValidHost(host) {
		if (!host || typeof host !== 'string') {
			return false
		}

		const normalized = KiloviewCubeR1.formatHostForUrl(host)
		if (normalized.startsWith('[') && normalized.endsWith(']')) {
			return isIP(normalized.slice(1, -1)) === 6
		}

		if (isIP(normalized) !== 0) {
			return true
		}

		// A dotted-numeric string that failed isIP() above is a mistyped address (e.g. "256.1.1.1"
		// or "192.168.1"), not a hostname. Per RFC 1123 the final label cannot be all digits, so
		// rejecting it here keeps those from being treated as resolvable names.
		if (/(^|\.)[0-9]+$/.test(normalized)) {
			return false
		}

		// Mirrors Regex.HOSTNAME from @companion-module/base, plus the DNS length limit.
		return (
			normalized.length <= 253 &&
			/^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/.test(
				normalized,
			)
		)
	}

	_verboseLog(message) {
		if (this.owner.config?.verbose) {
			this.log('debug', message)
		}
	}

	_request(method, path, data) {
		if (this._closed) {
			const error = new Error('Client closed')
			error.name = 'KiloviewR1Error'
			error.unreachable = true
			return Promise.reject(error)
		}

		return new Promise((resolve, reject) => {
			const isHttps = this.connection_info.protocol === 'https'
			const urlObj = new URL(`${this.baseURL}${path}`)

			let body = undefined
			if (data !== undefined && method === 'POST') {
				body = JSON.stringify(data)
			}

			const headers = {
				Accept: 'application/json, text/plain, */*',
				'Content-Type': 'application/json',
				Connection: 'keep-alive',
			}

			// The R1 web UI authenticates every request with an `app` header carrying the login
			// token and username as a JSON string (undocumented in the API guide, observed from the
			// device's own front end).
			if (this.token) {
				headers['app'] = JSON.stringify({ username: this.tokenUsername, token: this.token })
			}

			if (body !== undefined) {
				headers['Content-Length'] = Buffer.byteLength(body)
			}

			const options = {
				hostname: urlObj.hostname,
				port: urlObj.port || (isHttps ? 443 : 80),
				path: urlObj.pathname + urlObj.search,
				method: method,
				rejectUnauthorized: this.rejectUnauthorized,
				agent: isHttps ? this.httpsAgent : this.httpAgent,
				timeout: this.requestTimeout,
				headers: headers,
			}

			this._verboseLog(`HTTP ${method} ${options.path}`)

			const req = (isHttps ? https : http).request(options, (res) => {
				const chunks = []
				let bodyBytes = 0
				let bodyTooLarge = false
				const finish = () => {
					this._activeRequests.delete(req)
				}

				res.on('data', (chunk) => {
					if (bodyTooLarge) {
						return
					}

					// Count bytes, not decoded characters, so the cap holds for multi-byte responses.
					bodyBytes += chunk.length
					if (bodyBytes > this.maxBodyBytes) {
						bodyTooLarge = true
						req.destroy(new Error('Response body too large'))
						return
					}

					chunks.push(chunk)
				})
				res.on('error', (err) => {
					finish()
					const error = new Error(err.message)
					error.name = 'KiloviewR1Error'
					error.unreachable = true
					reject(error)
				})
				res.on('end', () => {
					finish()
					if (bodyTooLarge) {
						return
					}

					this._verboseLog(`HTTP ${method} ${options.path} -> ${res.statusCode}`)

					const resBody = Buffer.concat(chunks).toString('utf8')
					try {
						const parsed = JSON.parse(resBody)
						if (typeof parsed === 'object' && parsed !== null) {
							parsed._statusCode = res.statusCode
							resolve(parsed)
						} else {
							resolve({ _statusCode: res.statusCode, _raw: parsed })
						}
					} catch {
						resolve({ _statusCode: res.statusCode, _raw: resBody })
					}
				})
			})

			this._activeRequests.add(req)

			req.on('timeout', () => {
				const error = new Error('Request timed out')
				error.name = 'KiloviewR1Error'
				error.unreachable = true
				error.timeout = true
				req.destroy(error)
			})

			req.on('error', (err) => {
				this._activeRequests.delete(req)
				const error = new Error(err.message)
				error.name = 'KiloviewR1Error'
				error.unreachable = true
				if (err.message === 'Request timed out') {
					error.timeout = true
				}
				reject(error)
			})

			req.on('close', () => {
				this._activeRequests.delete(req)
			})

			if (body !== undefined) {
				req.write(body)
			}

			req.end()
		})
	}

	_apiError(result) {
		let message = 'API Error'
		if (result && result.result === 'error') {
			if (typeof result.msg === 'string' && result.msg !== '') {
				message = result.msg
			} else if (result.msg !== undefined && result.msg !== null) {
				// Numeric codes need the device's MsgCode lookup to become readable text.
				message = `Device error code ${result.msg}`
			} else if (result.reason) {
				message = `Device error (${result.reason})`
			} else {
				message = 'Device rejected the request'
			}
			if (result.reason && message.indexOf(String(result.reason)) === -1) {
				message += ` (${result.reason})`
			}
		} else if (result && result._statusCode) {
			message = `HTTP ${result._statusCode}`
		}
		const error = new Error(message)
		error.name = 'KiloviewR1Error'
		error.reason = result?.reason
		error.statusCode = result?._statusCode
		return error
	}

	/**
	 * A missing or expired session comes back as `{ result: 'error', msg: 'Token.Error' }` in
	 * the API guide, and as `Token_Error` from real devices. Both spellings (and an HTTP 401/403)
	 * are treated as an authentication failure so the caller can log in again.
	 */
	_isAuthFailure(result) {
		if (result?._statusCode === 401 || result?._statusCode === 403) {
			return true
		}

		if (result?.result === 'error' && typeof result.msg === 'string') {
			return /^token[._ -]?error$/i.test(result.msg.trim())
		}

		return false
	}

	_validateResult(result) {
		if (result?._statusCode >= 400) {
			this._throwApiError(result)
		}

		if (result?.result === 'error') {
			this._throwApiError(result)
		}
	}

	_throwApiError(result) {
		const error = this._apiError(result)
		if (this._isAuthFailure(result)) {
			error.authFailure = true
		}
		throw error
	}

	async _loginImpl() {
		const { username, password } = this.connection_info

		const previousToken = this.token
		const result = await this._request('POST', '/users/login.json', { username, password })

		if (result?.result === 'ok' && result.data?.token) {
			this.token = result.data.token
			this.tokenUsername = result.data.username || username
			this.authorized = true
			return true
		}

		this.token = previousToken
		this.authorized = false
		const error = this._apiError(result)
		if (result?._statusCode >= 500 || result?._statusCode === 0 || result?._statusCode === undefined) {
			error.unreachable = true
		} else {
			error.authFailure = true
		}
		throw error
	}

	async login() {
		return this._withAuthMutex(() => this._loginImpl())
	}

	async logout() {
		if (!this.authorized) {
			return
		}
		try {
			await this._request('GET', '/users/logout.json')
		} finally {
			this.token = ''
			this.tokenUsername = ''
			this.authorized = false
		}
	}

	close() {
		this._closed = true
		for (const req of this._activeRequests) {
			req.destroy()
		}
		this._activeRequests.clear()
		this.httpAgent.destroy()
		this.httpsAgent.destroy()
	}

	async authGet(path, params = {}) {
		if (!this.authorized) {
			await this.login()
		}

		const queryString = new URLSearchParams(params).toString()
		const fullPath = path + (queryString ? '?' + queryString : '')

		let result = await this._request('GET', fullPath)

		if (this._isAuthFailure(result)) {
			await this._withAuthMutex(() => this._loginImpl())
			result = await this._request('GET', fullPath)
		}

		this._validateResult(result)
		return result
	}

	async authPost(path, data = {}) {
		if (!this.authorized) {
			await this.login()
		}

		let result = await this._request('POST', path, data)

		if (this._isAuthFailure(result)) {
			await this._withAuthMutex(() => this._loginImpl())
			result = await this._request('POST', path, data)
		}

		this._validateResult(result)
		return result
	}

	// ------------------------------------------------------------------
	// System / info
	// ------------------------------------------------------------------

	async getGeneralConfig() {
		return await this.authGet('/config/general/get.json')
	}

	async getFirmware() {
		return await this.authGet('/firmware/get.json')
	}

	async getPerformance() {
		return await this.authGet('/performance/getSys.json')
	}

	async getNetwork() {
		return await this.authGet('/network/getNet.json')
	}

	async getHostname() {
		return await this.authGet('/system/getHostname.json')
	}

	async setHostname(hostname) {
		return await this.authPost('/system/setHostname.json', { hostname })
	}

	async getTimer() {
		return await this.authGet('/system/getTimer.json')
	}

	async setTimer(timeType, ip) {
		return await this.authPost('/system/setTimer.json', { timeType, ip })
	}

	async applyTimeSync(project_id) {
		return await this.authPost('/system/timer/apply.json', { project_id })
	}

	// ------------------------------------------------------------------
	// Source discovery
	// ------------------------------------------------------------------

	async getSourceList() {
		return await this.authGet('/source/list.json')
	}

	async refreshSources() {
		return await this.authPost('/source/refresh.json', { refresh: true })
	}

	// ------------------------------------------------------------------
	// Layout / windows (the "output" module)
	// ------------------------------------------------------------------

	async getLayouts() {
		return await this.authGet('/layout/icon.json')
	}

	async setLayout(project_id, layout_id, layout_number) {
		return await this.authPost('/layout/setLayout.json', { project_id, layout_id, layout_number })
	}

	async getOutput(project_id) {
		return await this.authGet('/output/get.json', { project_id })
	}

	/**
	 * `project_id`, `position`, `stream_id` and `type` are the documented parameters. The device's
	 * own web UI additionally sends the source's discovery details (`ip`, `disc_id`, `disc_name`),
	 * so they are included when known; the API guide does not say whether the device needs them.
	 */
	async setWindowSource(project_id, position, stream_id, source = {}) {
		const body = {
			project_id,
			position,
			stream_id,
			type: 'source',
		}

		if (source.ip) {
			body.ip = source.ip
		}
		if (source.disc_id) {
			body.disc_id = source.disc_id
		}
		if (source.group) {
			body.disc_name = source.group
		}

		return await this.authPost('/output/setSource.json', body)
	}

	async setWindowName(project_id, position, name) {
		return await this.authPost('/output/setName.json', { project_id, position, name })
	}

	async setWindowEnable(project_id, position, showAll, showVolume, showVideo) {
		return await this.authPost('/output/setEnable.json', {
			project_id,
			position,
			showAll,
			showVolume,
			showVideo,
		})
	}

	async removeWindowSource(project_id, position) {
		return await this.authPost('/output/remove.json', { project_id, position })
	}

	async clearAllWindows(project_id) {
		return await this.authPost('/output/deleteAll.json', { project_id })
	}

	async setGlobalVisible(project_id, outputGlobalVisible) {
		return await this.authPost('/output/setGlobalVisible.json', { project_id, outputGlobalVisible })
	}

	async setWindowAudio(project_id, position, on) {
		return await this.authPost('/output/window_audio_set.json', {
			project_id,
			position,
			volume: on ? 'on' : 'off',
		})
	}

	// ------------------------------------------------------------------
	// Recording
	// ------------------------------------------------------------------

	async getRecordStatus(project_id) {
		return await this.authGet('/record/getRecStatus.json', { project_id })
	}

	async setRecordStatus(isRecording) {
		return await this.authPost('/record/setRecStatus.json', { isRecording })
	}

	async getRecordInfo() {
		return await this.authGet('/record/getinfo.json')
	}

	async setRecordInfo(info) {
		return await this.authPost('/record/setinfo.json', info)
	}

	// ------------------------------------------------------------------
	// Storage
	// ------------------------------------------------------------------

	async getStorageInfo() {
		return await this.authGet('/storage/getStoInfo.json')
	}

	async setStorageLimit(choose, limitType, limitSize, limitTime) {
		return await this.authPost('/storage/setStoLimit.json', { choose, limitType, limitSize, limitTime })
	}
}

export default KiloviewCubeR1
