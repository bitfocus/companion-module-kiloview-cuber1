module.exports = {
	env: {
		node: true,
		es2021: true,
	},
	extends: ['@companion-module/tools/.eslintrc.json'],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
		ecmaFeatures: {
			jsx: true,
		},
	},
	rules: {
		'no-unused-vars': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/explicit-module-boundary-types': 'off',
	},
	ignorePatterns: ['dist', 'pkg', 'node_modules'],
}