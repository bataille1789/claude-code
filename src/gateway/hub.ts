import type { AgentAdapter } from './adapters/Adapter.js'
import { CommandAgentAdapter } from './adapters/CommandAgentAdapter.js'
import { ClaudeSwarmBridge } from './bridges/claudeSwarmBridge.js'
import { EventLog } from './eventLog.js'
import { PolicyEngine } from './policyEngine.js'
import { Router } from './router.js'
import type { GatewayConfig, GatewayTask } from './types.js'

export class GatewayHub {
	private readonly eventLog: EventLog
	private readonly policyEngine: PolicyEngine
	private readonly router: Router
	private readonly adapters: AgentAdapter[]
	private readonly bridge: ClaudeSwarmBridge | null

	constructor(private readonly config: GatewayConfig) {
		this.eventLog = new EventLog(config.eventLogPath)
		this.policyEngine = new PolicyEngine(config)
		this.adapters = config.agents.map((agent) => new CommandAgentAdapter(agent))
		this.router = new Router(this.adapters, this.policyEngine)
		this.bridge = config.claudeBridge ? new ClaudeSwarmBridge(config.claudeBridge) : null
	}

	async submitTask(task: GatewayTask): Promise<{ output: string; winner: string }> {
		await this.eventLog.append({
			type: 'task_received',
			at: new Date().toISOString(),
			task,
		})
		await this.bridge?.onTaskReceived(task)

		const taskPolicy = this.policyEngine.evaluateTask(task)
		if (!taskPolicy.allowed) {
			await this.eventLog.append({
				type: 'policy_blocked',
				at: new Date().toISOString(),
				taskId: task.id,
				reasons: taskPolicy.reasons,
			})
			await this.bridge?.onPolicyBlocked(task.id, taskPolicy.reasons)
			throw new Error(`Task blocked by policy: ${taskPolicy.reasons.join(', ')}`)
		}

		const decision = await this.router.allocate(task)
		await this.bridge?.onAllocation(task, decision)

		await this.eventLog.append({
			type: 'allocation_decided',
			at: new Date().toISOString(),
			decision,
		})

		const adapter = this.adapters.find((a) => a.id === decision.winnerAgentId)
		if (!adapter) {
			throw new Error(`Winner adapter not found: ${decision.winnerAgentId}`)
		}

		const output = await adapter.execute(task)
		await this.bridge?.onExecution(task.id, output, adapter.id)

		await this.eventLog.append({
			type: 'task_executed',
			at: new Date().toISOString(),
			taskId: task.id,
			agentId: adapter.id,
			output,
		})

		return {
			output,
			winner: adapter.id,
		}
	}
}
