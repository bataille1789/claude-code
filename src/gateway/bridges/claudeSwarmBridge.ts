import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AllocationDecision, GatewayTask } from '../types.js'

type ClaudeSwarmBridgeConfig = {
	enabled: boolean
	teamName?: string
	leaderName?: string
	mirrorToTasks?: boolean
	mirrorToMailbox?: boolean
}

type BridgeTask = {
	id: string
	subject: string
	description: string
	status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
	owner?: string
	blocks: string[]
	blockedBy: string[]
	metadata?: Record<string, unknown>
}

type MailMessage = {
	from: string
	text: string
	timestamp: string
	read: boolean
	summary?: string
	color?: string
}

/**
 * Lightweight bridge that mirrors gateway decisions into Claude-compatible
 * file areas without importing heavy runtime-only modules.
 */
export class ClaudeSwarmBridge {
	private readonly taskIdMap = new Map<string, string>()

	constructor(private readonly config: ClaudeSwarmBridgeConfig) {}

	private getTeamName(): string {
		return this.config.teamName || process.env.CLAUDE_CODE_TEAM_NAME || 'gateway-team'
	}

	private getLeaderName(): string {
		return this.config.leaderName || 'team-lead'
	}

	private getClaudeHome(): string {
		return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
	}

	private getTasksDir(): string {
		return join(this.getClaudeHome(), 'tasks', this.getTeamName().replace(/[^a-zA-Z0-9_-]/g, '-'))
	}

	private getInboxPath(agentName: string): string {
		return join(
			this.getClaudeHome(),
			'teams',
			this.getTeamName().replace(/[^a-zA-Z0-9_-]/g, '-'),
			'inboxes',
			`${agentName.replace(/[^a-zA-Z0-9_-]/g, '-')}.json`,
		)
	}

	private async appendMailbox(
		recipient: string,
		message: Omit<MailMessage, 'read'>,
	): Promise<void> {
		const inboxPath = this.getInboxPath(recipient)
		await mkdir(join(inboxPath, '..'), { recursive: true })

		let existing: MailMessage[] = []
		try {
			existing = JSON.parse(await readFile(inboxPath, 'utf8')) as MailMessage[]
		} catch {
			existing = []
		}

		existing.push({ ...message, read: false })
		await writeFile(inboxPath, JSON.stringify(existing, null, 2), 'utf8')
	}

	private async writeTask(taskId: string, task: BridgeTask): Promise<void> {
		const dir = this.getTasksDir()
		await mkdir(dir, { recursive: true })
		await writeFile(join(dir, `${taskId}.json`), JSON.stringify(task, null, 2), 'utf8')
	}

	private async readTask(taskId: string): Promise<BridgeTask | null> {
		try {
			const content = await readFile(join(this.getTasksDir(), `${taskId}.json`), 'utf8')
			return JSON.parse(content) as BridgeTask
		} catch {
			return null
		}
	}

	private async nextTaskId(): Promise<string> {
		const dir = this.getTasksDir()
		await mkdir(dir, { recursive: true })
		let files: string[] = []
		try {
			files = await readdir(dir)
		} catch {
			files = []
		}
		const maxId = files
			.filter((f) => f.endsWith('.json'))
			.map((f) => Number.parseInt(f.replace('.json', ''), 10))
			.filter((n) => !Number.isNaN(n))
			.reduce((max, n) => Math.max(max, n), 0)
		return String(maxId + 1)
	}

	async onTaskReceived(task: GatewayTask): Promise<void> {
		if (!this.config.enabled) return

		if (this.config.mirrorToTasks !== false) {
			const localTaskId = await this.nextTaskId()
			const mappedTask: BridgeTask = {
				id: localTaskId,
				subject: task.title,
				description: task.description,
				status: 'pending',
				owner: undefined,
				blocks: [],
				blockedBy: [],
				metadata: {
					source: 'gateway',
					gatewayTaskId: task.id,
					expectedValue: task.expectedValue,
					maxBudgetUsd: task.maxBudgetUsd,
					maxLatencyMs: task.maxLatencyMs,
					...(task.metadata ?? {}),
				},
			}
			await this.writeTask(localTaskId, mappedTask)
			this.taskIdMap.set(task.id, localTaskId)
		}

		if (this.config.mirrorToMailbox !== false) {
			await this.appendMailbox(this.getLeaderName(), {
				from: 'gateway-router',
				timestamp: new Date().toISOString(),
				summary: `Task received: ${task.title}`,
				text: `Gateway accepted task ${task.id}\nTitle: ${task.title}\nExpected value: ${task.expectedValue}`,
				color: 'cyan',
			})
		}
	}

	async onAllocation(task: GatewayTask, decision: AllocationDecision): Promise<void> {
		if (!this.config.enabled) return

		const localTaskId = this.taskIdMap.get(task.id)
		if (localTaskId && this.config.mirrorToTasks !== false) {
			const existing = await this.readTask(localTaskId)
			if (existing) {
				await this.writeTask(localTaskId, {
					...existing,
					status: 'in_progress',
					owner: decision.winnerAgentId,
					metadata: {
						...(existing.metadata ?? {}),
						winnerAgentId: decision.winnerAgentId,
						clearingPriceUsd: decision.clearingPriceUsd,
						utilityScore: decision.winningBid.utilityScore,
					},
				})
			}
		}

		if (this.config.mirrorToMailbox !== false) {
			const msg = `Allocated task ${task.id} to ${decision.winnerAgentId}\nPrice: $${decision.clearingPriceUsd.toFixed(4)}\nUtility: ${decision.winningBid.utilityScore.toFixed(4)}`
			await Promise.all([
				this.appendMailbox(this.getLeaderName(), {
					from: 'gateway-router',
					timestamp: new Date().toISOString(),
					summary: `Allocated -> ${decision.winnerAgentId}`,
					text: msg,
					color: 'green',
				}),
				this.appendMailbox(decision.winnerAgentId, {
					from: 'gateway-router',
					timestamp: new Date().toISOString(),
					summary: `Assigned task: ${task.title}`,
					text: `You won auction for task ${task.id}.\n${task.description}`,
					color: 'yellow',
				}),
			])
		}
	}

	async onExecution(taskId: string, output: string, winner: string): Promise<void> {
		if (!this.config.enabled) return

		const localTaskId = this.taskIdMap.get(taskId)
		if (localTaskId && this.config.mirrorToTasks !== false) {
			const existing = await this.readTask(localTaskId)
			if (existing) {
				await this.writeTask(localTaskId, {
					...existing,
					status: 'completed',
					metadata: {
						...(existing.metadata ?? {}),
						winnerAgentId: winner,
						outputPreview: output.slice(0, 400),
					},
				})
			}
		}

		if (this.config.mirrorToMailbox !== false) {
			await this.appendMailbox(this.getLeaderName(), {
				from: winner,
				timestamp: new Date().toISOString(),
				summary: `Completed: ${taskId}`,
				text: `Task ${taskId} completed by ${winner}.\nOutput:\n${output}`,
				color: 'magenta',
			})
		}
	}

	async onPolicyBlocked(taskId: string, reasons: string[]): Promise<void> {
		if (!this.config.enabled) return

		const localTaskId = this.taskIdMap.get(taskId)
		if (localTaskId && this.config.mirrorToTasks !== false) {
			const existing = await this.readTask(localTaskId)
			if (existing) {
				await this.writeTask(localTaskId, {
					...existing,
					status: 'cancelled',
					metadata: {
						...(existing.metadata ?? {}),
						policyBlocked: true,
						reasons,
					},
				})
			}
		}

		if (this.config.mirrorToMailbox !== false) {
			await this.appendMailbox(this.getLeaderName(), {
				from: 'gateway-router',
				timestamp: new Date().toISOString(),
				summary: `Policy blocked: ${taskId}`,
				text: `Task ${taskId} blocked by policy:\n- ${reasons.join('\n- ')}`,
				color: 'red',
			})
		}
	}
}
