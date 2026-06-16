const http = require('http')

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

			const result = await this._request('POST', '/users/login.json', {
				username: username,
				password: password,
			})

			if (result && result.result !== 'ok') {
				let error = new Error(result.msg || 'Authorization failed')
				error.name = 'Cuber1Error'
				throw error
			}

			// Build auth string from login response data
			if (result.data) {
				this.auth_string = JSON.stringify(result.data)
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
		return await this.authGet('/system/getHostname.json')
	}

	async setHostname(hostname) {
		return await this.authPost('/system/setHostname.json', { hostname })
	}

	async getTimeZone() {
		return await this.authGet('/system/getTimeZone.json')
	}

	async setTimeZone(timezone, offset) {
		return await this.authPost('/system/setTimeZone.json', { timezone, offset })
	}

	async reboot() {
		return await this.authGet('/system/reboot')
	}

	async getSystemInfo() {
		return await this.authGet('/api/systemctrl/report/get_system_info')
	}

	async getNetworkInfo() {
		return await this.authGet('/api/networkmanager/report/get_network')
	}

	// ===== Layout APIs =====

	async getLayoutList() {
		return await this.authGet('/layout/icon.json')
	}

	async setLayout(layout_id) {
		return await this.authPost('/layout/setLayout.json', { layout_id })
	}

	// ===== Output (Source Assignment) APIs =====

	async getOutput() {
		return await this.authGet('/output/get.json')
	}

	async setSource(params) {
		return await this.authPost('/output/setSource.json', params)
	}

	async removeSource(position) {
		return await this.authPost('/output/remove.json', { position })
	}

	async removeAllSources() {
		return await this.authPost('/output/deleteAll.json', {})
	}

	async setChannelName(position, name) {
		return await this.authPost('/output/setName.json', { position, name })
	}

	// ===== Recording APIs =====

	async getRecStatus() {
		return await this.authGet('/record/getRecStatus.json')
	}

	async setRecStatus(isRecording) {
		return await this.authPost('/record/setRecStatus.json', { isRecording })
	}

	async getRecInfo() {
		return await this.authGet('/record/getinfo.json')
	}

	async setRecInfo(params) {
		return await this.authPost('/record/setinfo.json', params)
	}

	async getRecordMode() {
		return await this.authGet('/record/getMode')
	}

	async setRecordMode(data) {
		return await this.authPost('/record/setMode', { data })
	}

	async setSingleRec(id, data) {
		return await this.authPost('/record/setSingleRec', { id, data })
	}

	async getLinIns() {
		return await this.authGet('/record/getLinIns')
	}

	async setLinIns(data) {
		return await this.authPost('/record/setLinIns', { data })
	}

	async setLinIn(pos, value) {
		return await this.authPost('/record/setLinIn', { pos, value })
	}

	async setLinInDelay(data) {
		return await this.authPost('/record/setLinInDelay', { data })
	}

	async getLinInDelay() {
		return await this.authGet('/record/getLinInDelay')
	}

	// ===== Source Discovery APIs =====

	async getSourceList() {
		return await this.authGet('/source/list.json')
	}

	async addSource(params) {
		return await this.authPost('/source/add.json', params)
	}

	async getSourceParam() {
		return await this.authGet('/source/get_param.json')
	}

	async modifySource(params) {
		return await this.authPost('/source/modify.json', params)
	}

	async removeSourceGroup(disc_id) {
		return await this.authPost('/source/remove.json', { disc_id })
	}

	async refreshSources() {
		return await this.authPost('/source/refresh.json', { refresh: true })
	}

	async setSourceListSorting(data) {
		return await this.authPost('/source/setSourceListSorting', { data })
	}

	async getSourceListSorting() {
		return await this.authGet('/source/getSourceListSorting')
	}

	// ===== Storage APIs =====

	async setStorageConfig(params) {
		return await this.authPost('/storage/setStoLimit.json', params)
	}

	async getStorageInfo() {
		return await this.authGet('/storage/getStoInfo.json')
	}

	async formatDisk(data) {
		return await this.authGet(`/storage/formatDisk?data=${data}`)
	}

	// NAS
	async getNasList() {
		return await this.authGet('/storage/nas/get')
	}

	async addNas(params) {
		return await this.authPost('/storage/nas/add', params)
	}

	async updateNas(params) {
		return await this.authPost('/storage/nas/update', params)
	}

	async deleteNas(nasid) {
		return await this.authPost('/storage/nas/delete', { nasid })
	}

	// FTP
	async addFtpServer(params) {
		return await this.authPost('/storage/ftp/addFtp', params)
	}

	async getFtpList() {
		return await this.authGet('/storage/ftp/getFtpList')
	}

	async updateFtpServer(params) {
		return await this.authPost('/storage/ftp/updateFtp', params)
	}

	async deleteFtpServer(data) {
		return await this.authPost('/storage/ftp/delFtp', { data })
	}

	async addFtpUpload(params) {
		return await this.authPost('/storage/ftp/addUpload', params)
	}

	async getFtpUploadStatus() {
		return await this.authGet('/storage/ftp/getUpload')
	}

	async reUpload(id) {
		return await this.authPost('/storage/ftp/reUpload', { id })
	}

	async cancelFtpUpload(id) {
		return await this.authPost('/storage/ftp/requestCancel', { id })
	}

	async cancelAllFtpUploads() {
		return await this.authGet('/storage/ftp/requestCancelAll')
	}

	// ===== Recording Status (New API) =====

	async getRecordingStatus() {
		return await this.authGet('/api/record/recording/get_recording_status')
	}

	async getRecordSettings() {
		return await this.authGet('/api/record/report/get_settings')
	}

	async getStorageReportInfo() {
		return await this.authGet('/api/record/report/get_storage_info')
	}

	async getOutputReport() {
		return await this.authGet('/api/record/report/get_output')
	}

	// ===== Recording File APIs =====

	async getSessionFilePaths() {
		return await this.authGet('/record/getSessionFilePaths.json')
	}

	// ===== Playback APIs =====

	async getPlayListInfo(params) {
		return await this.authPost('/playback/getPlayListInfo.json', params)
	}

	async deleteVideo(videoSrc) {
		return await this.authPost('/playback/remove.json', { videoSrc })
	}

	async getVideoInfo() {
		return await this.authGet('/playback/getVideoInfo.json')
	}

	// ===== Performance / Config APIs =====

	async getPerformance() {
		return await this.authGet('/performance/getSys.json')
	}

	async getGeneralConfig() {
		return await this.authGet('/config/general/get.json')
	}

	// ===== Firmware APIs =====

	async getFirmwareInfo() {
		return await this.authGet('/firmware/get.json')
	}
}

module.exports = cuber1Device