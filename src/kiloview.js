const http = require('http')

const API_PREFIX = '/api/r1'

class cuber1Device {
	connection_info = {
		ip: '',
		username: '',
		password: '',
		port: 80,
	}

	auth_string = ''
	authorized = false
	owner = null

	log(level, message) {
		this.owner.log(level, message)
	}

	constructor(owner, ip, username, password, port = 80, timeout = 5000) {
		this.owner = owner
		this.connection_info = {
			ip,
			username,
			password,
			port,
		}

		this.baseURL = `http://${ip}:${port}`

		this.httpAgent = new http.Agent({
			keepAlive: true,
			keepAliveMsecs: 30000,
			maxSockets: 5,
		})

		this.authorized = false
	}

	_request(method, path, data) {
		return new Promise((resolve, reject) => {
			const urlObj = new URL(`${this.baseURL}${path}`)
			const options = {
				hostname: urlObj.hostname,
				port: urlObj.port || 80,
				path: urlObj.pathname + urlObj.search,
				method: method,
				agent: this.httpAgent,
				headers: {
					'Content-Type': 'application/json',
					'Connection': 'keep-alive',
				},
			}

			// Add app header for authentication if authorized
			if (this.auth_string) {
				options.headers['app'] = this.auth_string
			}

			const req = http.request(options, (res) => {
				let body = ''
				res.on('data', (chunk) => {
					body += chunk
				})
				res.on('end', () => {
					try {
						resolve(JSON.parse(body))
					} catch (e) {
						resolve(body)
					}
				})
			})

			req.on('error', (err) => {
				let error = new Error(err.message)
				error.name = 'Cuber1Error'
				reject(error)
			})

			req.setTimeout(5000, () => {
				req.destroy(new Error('Request timeout'))
			})

			if (data && method === 'POST') {
				req.write(JSON.stringify(data))
			}

			req.end()
		})
	}

	setAuthorized(auth) {
		this.authorized = auth
	}

	async authorize() {
		try {
			const { username, password } = this.connection_info

			const result = await this._request('POST', `${API_PREFIX}/users/login.json`, {
				username: username,
				password: password,
			})

			if (result && result.result !== 'ok') {
				let error = new Error(result.msg || 'Authorization failed')
				error.name = 'Cuber1Error'
				throw error
			}

			// Build auth string from login response - only username and token
			if (result.data) {
				this.auth_string = JSON.stringify({
					username: result.data.username,
				token: result.data.token,
				})
			}

			this.authorized = true
			return true
		} catch (error) {
			if (error.name !== 'Cuber1Error') {
				let newError = new Error('Could not reach device')
				newError.name = 'Cuber1Error'
				throw newError
			}
			throw error
		}
	}

	async authGet(url, params = {}) {
		if (!this.authorized) {
			await this.authorize()
		}

		const queryString = new URLSearchParams(params).toString()
		const fullPath = url + (queryString ? '?' + queryString : '')

		let result = await this._request('GET', fullPath)

		if (result && (result.result === 'error' && result.msg === 'Token_Error')) {
			await this.authorize()
			return this.authGet(url, params)
		}

		return result
	}

	async authPost(url, data = {}) {
		if (!this.authorized) {
			await this.authorize()
		}

		let result = await this._request('POST', url, data)

		if (result && (result.result === 'error' && result.msg === 'Token_Error')) {
			await this.authorize()
			return this.authPost(url, data)
		}

		return result
	}

	// ===== System APIs =====

	async getHostname() {
		return await this.authGet(`${API_PREFIX}/system/getHostname.json`)
	}

	async setHostname(hostname) {
		return await this.authPost(`${API_PREFIX}/system/setHostname.json`, { hostname })
	}

	async getTimeZone() {
		return await this.authGet(`${API_PREFIX}/system/getTimeZone.json`)
	}

	async setTimeZone(timezone, offset) {
		return await this.authPost(`${API_PREFIX}/system/setTimeZone.json`, { timezone, offset })
	}

	async reboot() {
		return await this.authGet(`${API_PREFIX}/system/reboot`)
	}

	async getSystemInfo() {
		return await this.authGet(`${API_PREFIX}/performance/getSys.json`)
	}

	async getNetworkInfo() {
		return await this.authGet(`${API_PREFIX}/network/getNet.json`)
	}

	// ===== Layout APIs =====

	async getLayoutList() {
		return await this.authGet(`${API_PREFIX}/layout/icon.json`)
	}

	async setLayout(layout_id) {
		return await this.authPost(`${API_PREFIX}/layout/setLayout.json`, { layout_id })
	}

	// ===== Output (Source Assignment) APIs =====

	async getOutput() {
		return await this.authGet(`${API_PREFIX}/output/get.json`)
	}

	async setSource(params) {
		return await this.authPost(`${API_PREFIX}/output/setSource.json`, params)
	}

	async removeSource(position) {
		return await this.authPost(`${API_PREFIX}/output/remove.json`, { position })
	}

	async removeAllSources() {
		return await this.authPost(`${API_PREFIX}/output/deleteAll.json`, {})
	}

	async setChannelName(position, name) {
		return await this.authPost(`${API_PREFIX}/output/setName.json`, { position, name })
	}

	// ===== Recording APIs =====

	async getRecStatus() {
		return await this.authGet(`${API_PREFIX}/record/getRecStatus.json`)
	}

	async setRecStatus(isRecording) {
		return await this.authPost(`${API_PREFIX}/record/setRecStatus.json`, { isRecording })
	}

	async getRecInfo() {
		return await this.authGet(`${API_PREFIX}/record/getinfo.json`)
	}

	async setRecInfo(params) {
		return await this.authPost(`${API_PREFIX}/record/setinfo.json`, params)
	}

	async getRecordMode() {
		return await this.authGet(`${API_PREFIX}/record/getMode`)
	}

	async setRecordMode(data) {
		return await this.authPost(`${API_PREFIX}/record/setMode`, { data })
	}

	async setSingleRec(id, data) {
		return await this.authPost(`${API_PREFIX}/record/setSingleRec`, { id, data })
	}

	async getLinIns() {
		return await this.authGet(`${API_PREFIX}/record/getLinIns`)
	}

	async setLinIns(data) {
		return await this.authPost(`${API_PREFIX}/record/setLinIns`, { data })
	}

	async setLinIn(pos, value) {
		return await this.authPost(`${API_PREFIX}/record/setLinIn`, { pos, value })
	}

	async setLinInDelay(data) {
		return await this.authPost(`${API_PREFIX}/record/setLinInDelay`, { data })
	}

	async getLinInDelay() {
		return await this.authGet(`${API_PREFIX}/record/getLinInDelay`)
	}

	// ===== Source Discovery APIs =====

	async getSourceList() {
		return await this.authGet(`${API_PREFIX}/source/list.json`)
	}

	async addSource(params) {
		return await this.authPost(`${API_PREFIX}/source/add.json`, params)
	}

	async getSourceParam() {
		return await this.authGet(`${API_PREFIX}/source/get_param.json`)
	}

	async modifySource(params) {
		return await this.authPost(`${API_PREFIX}/source/modify.json`, params)
	}

	async removeSourceGroup(disc_id) {
		return await this.authPost(`${API_PREFIX}/source/remove.json`, { disc_id })
	}

	async refreshSources() {
		return await this.authPost(`${API_PREFIX}/source/refresh.json`, { refresh: true })
	}

	async setSourceListSorting(data) {
		return await this.authPost(`${API_PREFIX}/source/setSourceListSorting`, { data })
	}

	async getSourceListSorting() {
		return await this.authGet(`${API_PREFIX}/source/getSourceListSorting`)
	}

	// ===== Storage APIs =====

	async setStorageConfig(params) {
		return await this.authPost(`${API_PREFIX}/storage/setStoLimit.json`, params)
	}

	async getStorageInfo() {
		return await this.authGet(`${API_PREFIX}/storage/getStoInfo.json`)
	}

	async formatDisk(data) {
		return await this.authGet(`${API_PREFIX}/storage/formatDisk?data=${data}`)
	}

	// NAS
	async getNasList() {
		return await this.authGet(`${API_PREFIX}/storage/nas/get`)
	}

	async addNas(params) {
		return await this.authPost(`${API_PREFIX}/storage/nas/add`, params)
	}

	async updateNas(params) {
		return await this.authPost(`${API_PREFIX}/storage/nas/update`, params)
	}

	async deleteNas(nasid) {
		return await this.authPost(`${API_PREFIX}/storage/nas/delete`, { nasid })
	}

	// FTP
	async addFtpServer(params) {
		return await this.authPost(`${API_PREFIX}/storage/ftp/addFtp`, params)
	}

	async getFtpList() {
		return await this.authGet(`${API_PREFIX}/storage/ftp/getFtpList`)
	}

	async updateFtpServer(params) {
		return await this.authPost(`${API_PREFIX}/storage/ftp/updateFtp`, params)
	}

	async deleteFtpServer(data) {
		return await this.authPost(`${API_PREFIX}/storage/ftp/delFtp`, { data })
	}

	async addFtpUpload(params) {
		return await this.authPost(`${API_PREFIX}/storage/ftp/addUpload`, params)
	}

	async getFtpUploadStatus() {
		return await this.authGet(`${API_PREFIX}/storage/ftp/getUpload`)
	}

	async reUpload(id) {
		return await this.authPost(`${API_PREFIX}/storage/ftp/reUpload`, { id })
	}

	async cancelFtpUpload(id) {
		return await this.authPost(`${API_PREFIX}/storage/ftp/requestCancel`, { id })
	}

	async cancelAllFtpUploads() {
		return await this.authGet(`${API_PREFIX}/storage/ftp/requestCancelAll`)
	}

	// ===== Recording Status (New API) =====

	async getRecordingStatus() {
		return await this.authGet(`${API_PREFIX}/record/getRecStatus.json`)
	}

	async getRecordSettings() {
		return await this.authGet(`${API_PREFIX}/record/getinfo.json`)
	}

	async getStorageReportInfo() {
		return await this.authGet(`${API_PREFIX}/storage/getStoInfo.json`)
	}

	async getOutputReport() {
		return await this.authGet(`${API_PREFIX}/output/get.json`)
	}

	// ===== Recording File APIs =====

	async getSessionFilePaths() {
		return await this.authGet(`${API_PREFIX}/record/getSessionFilePaths.json`)
	}

	// ===== Playback APIs =====

	async getPlayListInfo(params) {
		return await this.authPost(`${API_PREFIX}/playback/getPlayListInfo.json`, params)
	}

	async deleteVideo(videoSrc) {
		return await this.authPost(`${API_PREFIX}/playback/remove.json`, { videoSrc })
	}

	async getVideoInfo() {
		return await this.authGet(`${API_PREFIX}/playback/getVideoInfo.json`)
	}

	// ===== Performance / Config APIs =====

	async getPerformance() {
		return await this.authGet(`${API_PREFIX}/performance/getSys.json`)
	}

	async getGeneralConfig() {
		return await this.authGet(`${API_PREFIX}/config/general/get.json`)
	}

	// ===== Firmware APIs =====

	async getFirmwareInfo() {
		return await this.authGet(`${API_PREFIX}/firmware/get.json`)
	}
}

module.exports = cuber1Device