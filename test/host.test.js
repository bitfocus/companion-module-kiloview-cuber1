import test from 'node:test'
import assert from 'node:assert/strict'

import KiloviewCubeR1 from '../src/cuber1.js'
import { Regex } from '@companion-module/base'

test('formatHostForUrl brackets bare IPv6 and leaves everything else alone', () => {
	assert.equal(KiloviewCubeR1.formatHostForUrl('192.168.1.10'), '192.168.1.10')
	assert.equal(KiloviewCubeR1.formatHostForUrl('  192.168.1.10  '), '192.168.1.10')
	assert.equal(KiloviewCubeR1.formatHostForUrl('cube.local'), 'cube.local')
	assert.equal(KiloviewCubeR1.formatHostForUrl('fe80::1'), '[fe80::1]')
	assert.equal(KiloviewCubeR1.formatHostForUrl('[fe80::1]'), '[fe80::1]')
})

test('isValidHost accepts IPv4 addresses', () => {
	for (const host of ['192.168.1.10', '10.0.0.1', '0.0.0.0', '255.255.255.255', '127.0.0.1']) {
		assert.equal(KiloviewCubeR1.isValidHost(host), true, host)
	}
})

test('isValidHost accepts IPv6 addresses, bare or bracketed', () => {
	for (const host of ['fe80::1', '[fe80::1]', '::1', '2001:db8::8a2e:370:7334', '[::]']) {
		assert.equal(KiloviewCubeR1.isValidHost(host), true, host)
	}
})

test('isValidHost accepts hostnames', () => {
	for (const host of ['cube', 'cube.local', 'cube-r1.studio.example.com', 'a', 'r1-01']) {
		assert.equal(KiloviewCubeR1.isValidHost(host), true, host)
	}
})

test('isValidHost rejects malformed hosts', () => {
	for (const host of [
		'',
		'   ',
		'256.1.1.1',
		'192.168.1',
		'192.168.1.10.5',
		'-cube.local',
		'cube-.local',
		'cube..local',
		'cube.local/api',
		'cube local',
		'http://cube.local',
		'[:::::]',
		'[not-ipv6]',
		'12345',
		'cube.local.5',
		`${'a'.repeat(64)}.${'b'.repeat(200)}.com`,
	]) {
		assert.equal(KiloviewCubeR1.isValidHost(host), false, JSON.stringify(host))
	}
})

test('isValidHost rejects non-string input without throwing', () => {
	for (const host of [undefined, null, 0, 12345, {}, [], true]) {
		assert.equal(KiloviewCubeR1.isValidHost(host), false, String(host))
	}
})

// Regex.IP / Regex.HOSTNAME from @companion-module/base are `/pattern/`-delimited strings, not
// RegExp objects. Calling .test() on them throws and would take the whole module down during init.
test('validating a host does not throw', () => {
	assert.doesNotThrow(() => KiloviewCubeR1.isValidHost('192.168.1.10'))
	assert.equal(typeof Regex.IP, 'string')
	assert.equal(typeof Regex.HOSTNAME, 'string')
})
