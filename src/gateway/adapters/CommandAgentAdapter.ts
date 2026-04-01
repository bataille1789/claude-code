import { execa } from 'execa'
import { applyProviderStrengthBoost } from '../strengths.js'
import type { AgentProfile, Bid, GatewayTask } from '../types.js'

function clamp01(value: number): number {
	if (value < 0) return 0
	if (value > 1) return 1
	return value
}

export class CommandAgentAdapter {
	readonly id: string

	constructor(private readonly profile: AgentProfile) {
		this.id = profile.id
	}

	async getBid(task: GatewayTask): Promise<Bid> {
		const capabilityCoverage =
			task.requiredCapabilities.filter((cap) => this.profile.capabilities.includes(cap)).length /
			Math.max(task.requiredCapabilities.length, 1)

		const demandMultiplier = 1 + task.urgency * 0.35
		const complexityMultiplier =
			1 + task.requiredCapabilities.length * 0.15 + task.description.length / 4000

		const estimatedCostUsd =
			this.profile.baseCostPer1kTokensUsd * 3.2 * demandMultiplier * complexityMultiplier
		const estimatedLatencyMs =
			5_000 +
			task.requiredCapabilities.length * 1_500 +
			Math.round((1 - this.profile.historicalQuality) * 4_000)

		const confidence = clamp01(this.profile.historicalQuality * 0.65 + capabilityCoverage * 0.35)
		const qualityScore = clamp01(this.profile.historicalQuality * capabilityCoverage)
		const riskScore = clamp01(this.profile.riskScore)

		const bid: Bid = {
			taskId: task.id,
			agentId: this.profile.id,
			estimatedCostUsd,
			estimatedLatencyMs,
			confidence,
			qualityScore,
			riskScore,
			utilityScore: 0,
			rationale: `coverage=${capabilityCoverage.toFixed(2)} quality=${qualityScore.toFixed(2)} risk=${riskScore.toFixed(2)}`,
		}

		return applyProviderStrengthBoost(task, this.profile, bid)
	}

	async execute(task: GatewayTask): Promise<string> {
		const args = [...(this.profile.args ?? []), task.description]
		const result = await execa(this.profile.command, args, {
			env: {
				...process.env,
				...(this.profile.env ?? {}),
			},
			reject: false,
		})

		if (result.exitCode !== 0) {
			return `agent=${this.profile.id} failed: ${result.stderr || result.stdout}`
		}

		return result.stdout || `agent=${this.profile.id} completed with empty output`
	}
}
