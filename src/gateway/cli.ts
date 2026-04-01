import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import YAML from 'yaml'
import { GatewayHub } from './hub.js'
import type { GatewayConfig, GatewayTask } from './types.js'

function parseArgs(args: string[]): { configPath: string; prompt: string } {
	const configIndex = args.indexOf('--config')
	const promptIndex = args.indexOf('--prompt')

	const configPath = configIndex !== -1 ? args[configIndex + 1] : './gateway.yaml'
	const prompt = promptIndex !== -1 ? args[promptIndex + 1] : ''

	if (!prompt) {
		throw new Error('Missing --prompt')
	}

	return { configPath, prompt }
}

async function loadConfig(path: string): Promise<GatewayConfig> {
	const raw = await readFile(resolve(path), 'utf8')
	const parsed = YAML.parse(raw)

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`Invalid gateway config: ${path}`)
	}

	return parsed as GatewayConfig
}

function createTaskFromPrompt(prompt: string): GatewayTask {
	return {
		id: randomUUID(),
		title: prompt.slice(0, 80),
		description: prompt,
		requiredCapabilities: ['analyze', 'implement', 'test'],
		expectedValue: 10,
		urgency: 0.5,
		maxBudgetUsd: 3,
		maxLatencyMs: 25_000,
		allowedTools: ['Read', 'Edit', 'Bash'],
		allowedScopes: ['read', 'edit', 'exec'],
	}
}

export async function gatewayMain(argv: string[]): Promise<void> {
	const { configPath, prompt } = parseArgs(argv)
	const config = await loadConfig(configPath)

	const hub = new GatewayHub(config)
	const task = createTaskFromPrompt(prompt)

	const result = await hub.submitTask(task)
	console.log(JSON.stringify(result, null, 2))
}

if (import.meta.main) {
	await gatewayMain(process.argv.slice(2))
}
