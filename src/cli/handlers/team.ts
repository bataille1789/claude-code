import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execa } from 'execa'
import YAML from 'yaml'

type TeamLaunchOptions = {
	config?: string
	dryRun?: boolean
}

type TeamConfig = {
	agents?: Record<string, unknown>
	appendSystemPrompt?: string
	claudeArgs?: string[]
}

/**
 * Rebuild-style multi-agent launcher.
 *
 * `claude team` re-execs Claude with teammate mode enabled so users can
 * access TeamCreate/Task/SendMessage flows without remembering hidden flags.
 */
function loadTeamConfig(configPath: string): TeamConfig {
	const resolved = resolve(configPath)
	const raw = readFileSync(resolved, 'utf8')
	const parsed = YAML.parse(raw)

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`Invalid team config: ${configPath}`)
	}

	return parsed as TeamConfig
}

export async function teamHandler(
	teamArgs: string[],
	options: TeamLaunchOptions = {},
): Promise<void> {
	const executable = process.argv[0]
	const entrypoint = process.argv[1]

	if (!executable || !entrypoint) {
		process.stderr.write('Error: failed to resolve Claude executable path.\n')
		process.exit(1)
	}

	const childArgs = [entrypoint, '--agent-teams']

	if (options.config) {
		const config = loadTeamConfig(options.config)

		if (config.agents) {
			childArgs.push('--agents', JSON.stringify(config.agents))
		}
		if (config.appendSystemPrompt) {
			childArgs.push('--append-system-prompt', config.appendSystemPrompt)
		}
		if (Array.isArray(config.claudeArgs)) {
			childArgs.push(...config.claudeArgs)
		}
	}

	childArgs.push(...teamArgs)

	if (options.dryRun) {
		process.stdout.write(`${executable} ${childArgs.join(' ')}\n`)
		return
	}

	const result = await execa(executable, childArgs, {
		stdio: 'inherit',
		reject: false,
		env: {
			...process.env,
			CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
		},
	})

	process.exit(result.exitCode ?? 0)
}
