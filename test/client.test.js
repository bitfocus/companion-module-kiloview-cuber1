import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

import KiloviewCubeR1 from '../src/cuber1.js'

// Spins up a throwaway HTTP server that plays the role of a CUBE R1 and records what the client
// sends, so the auth handshake and error mapping are exercised against real request plumbing.
async function withFakeDevice(handler, fn) {
	const requests = []
	const server = http.createServer((req, res) => {
		let body = ''
		req.on('data', (chunk) => (body += chunk))
		req.on('end', () => {
			const entry = {
				method: req.method,
				url: req.url,
				headers: req.headers,
				body: body ? JSON.parse(body) : undefined,
			}
			requests.push(entry)
			const reply = handler(entry, requests)
			res.statusCode = reply.status ?? 200
			res.setHeader('Content-Type', 'application/json')
			res.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body))
		})
	})

	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	const port = server.address().port
	const owner = {
		logs: [],
		config: { verbose: false },
		log: (level, message) => owner.logs.push(`${level}: ${message}`),
	}
	const client = new KiloviewCubeR1(owner, '127.0.0.1', 'admin', 'admin', 'http', port, { requestTimeout: 1000 })

	try {
		await fn(client, requests, owner)
	} finally {
		client.close()
		await new Promise((resolve) => server.close(resolve))
	}
}

const loginOk = { body: { result: 'ok', data: { alias: 'admin', changed: true, token: 'tok123', username: 'admin' } } }

test('login posts credentials and later requests carry the app token header', async () => {
	await withFakeDevice(
		(req) => {
			if (req.url === '/api/r1/users/login.json') {
				return loginOk
			}
			return { body: { result: 'ok', data: { hostname: 'CubeR1' } } }
		},
		async (client, requests) => {
			const result = await client.getHostname()

			assert.equal(result.data.hostname, 'CubeR1')
			assert.equal(requests[0].method, 'POST')
			assert.deepEqual(requests[0].body, { username: 'admin', password: 'admin' })
			assert.equal(requests[0].headers.app, undefined, 'login itself must not send a token')

			assert.equal(requests[1].url, '/api/r1/system/getHostname.json')
			assert.deepEqual(JSON.parse(requests[1].headers.app), { username: 'admin', token: 'tok123' })
		},
	)
})

test('a bad password is reported as an authentication failure, not as unreachable', async () => {
	await withFakeDevice(
		() => ({ body: { result: 'error', msg: 'Username or password is incorrect' } }),
		async (client) => {
			await assert.rejects(
				() => client.login(),
				(error) => error.authFailure === true && error.unreachable !== true && /incorrect/.test(error.message),
			)
			assert.equal(client.authorized, false)
		},
	)
})

test('an expired token triggers exactly one re-login and the request is retried', async () => {
	let logins = 0
	await withFakeDevice(
		(req) => {
			if (req.url === '/api/r1/users/login.json') {
				logins++
				return { body: { result: 'ok', data: { token: `tok${logins}`, username: 'admin' } } }
			}

			const token = JSON.parse(req.headers.app).token
			if (token === 'tok1') {
				// real devices spell it Token_Error; the API guide says Token.Error
				return { body: { result: 'error', msg: logins === 1 ? 'Token_Error' : 'Token.Error' } }
			}
			return { body: { result: 'ok' } }
		},
		async (client, requests) => {
			const result = await client.setRecordStatus(true)

			assert.equal(result.result, 'ok')
			assert.equal(logins, 2)
			assert.deepEqual(
				requests.map((r) => r.url),
				[
					'/api/r1/users/login.json',
					'/api/r1/record/setRecStatus.json',
					'/api/r1/users/login.json',
					'/api/r1/record/setRecStatus.json',
				],
			)
			assert.deepEqual(requests[3].body, { isRecording: true })
		},
	)
})

test('device business errors surface the message and reason without flagging auth', async () => {
	await withFakeDevice(
		(req) => {
			if (req.url === '/api/r1/users/login.json') {
				return loginOk
			}
			return { body: { result: 'error', reason: 'out-of-auth' } }
		},
		async (client) => {
			await assert.rejects(
				() => client.setWindowSource(1, 3, 'CAM 1'),
				(error) => error.authFailure !== true && error.reason === 'out-of-auth' && /out-of-auth/.test(error.message),
			)
		},
	)
})

test('numeric error codes are surfaced rather than swallowed', async () => {
	await withFakeDevice(
		(req) => {
			if (req.url === '/api/r1/users/login.json') {
				return loginOk
			}
			return { body: { result: 'error', msg: 1100 } }
		},
		async (client) => {
			await assert.rejects(() => client.getStorageInfo(), /Device error code 1100/)
		},
	)
})

test('an HTTP error status is rejected even when the body is not JSON', async () => {
	await withFakeDevice(
		(req) => {
			if (req.url === '/api/r1/users/login.json') {
				return loginOk
			}
			return { status: 500, body: '<html>Internal Server Error</html>' }
		},
		async (client) => {
			await assert.rejects(() => client.getPerformance(), /HTTP 500/)
		},
	)
})

test('window and layout calls send the documented request bodies', async () => {
	await withFakeDevice(
		(req) => (req.url === '/api/r1/users/login.json' ? loginOk : { body: { result: 'ok' } }),
		async (client, requests) => {
			await client.setLayout(1, 3, 9)
			await client.setWindowAudio(1, 6, false)
			await client.setWindowEnable(1, 2, false, true, false)
			await client.getOutput(1)

			const bodies = requests.slice(1).map((r) => [r.url, r.body])
			assert.deepEqual(bodies, [
				['/api/r1/layout/setLayout.json', { project_id: 1, layout_id: 3, layout_number: 9 }],
				['/api/r1/output/window_audio_set.json', { project_id: 1, position: 6, volume: 'off' }],
				[
					'/api/r1/output/setEnable.json',
					{ project_id: 1, position: 2, showAll: false, showVolume: true, showVideo: false },
				],
				['/api/r1/output/get.json?project_id=1', undefined],
			])
		},
	)
})

test('a closed client rejects new requests as unreachable and a dead port is unreachable', async () => {
	await withFakeDevice(
		() => loginOk,
		async (client) => {
			client.close()
			await assert.rejects(
				() => client.login(),
				(error) => error.unreachable === true,
			)
		},
	)

	const owner = { logs: [], config: {}, log: () => {} }
	const dead = new KiloviewCubeR1(owner, '127.0.0.1', 'admin', 'admin', 'http', 1, { requestTimeout: 1000 })
	try {
		await assert.rejects(
			() => dead.login(),
			(error) => error.unreachable === true,
		)
	} finally {
		dead.close()
	}
})
