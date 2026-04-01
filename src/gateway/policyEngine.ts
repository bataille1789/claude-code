import type { Bid, GatewayConfig, GatewayTask, PolicyDecision } from './types.js'

export class PolicyEngine {
	constructor(private readonly config: GatewayConfig) {}

	evaluateTask(task: GatewayTask): PolicyDecision {
		const reasons: string[] = []

		if (task.maxBudgetUsd <= 0) reasons.push('maxBudgetUsd must be > 0')
		if (task.expectedValue <= 0) reasons.push('expectedValue must be > 0')
		if (task.allowedScopes.length === 0) {
			reasons.push('at least one allowed scope is required')
		}

		return {
			allowed: reasons.length === 0,
			reasons,
		}
	}

	evaluateBid(task: GatewayTask, bid: Bid): PolicyDecision {
		const reasons: string[] = []
		if (bid.estimatedCostUsd > task.maxBudgetUsd) {
			reasons.push(
				`bid cost ${bid.estimatedCostUsd.toFixed(2)} exceeds max budget ${task.maxBudgetUsd.toFixed(2)}`,
			)
		}
		if (bid.estimatedLatencyMs > task.maxLatencyMs) {
			reasons.push(`bid latency ${bid.estimatedLatencyMs} exceeds max latency ${task.maxLatencyMs}`)
		}
		if (bid.riskScore > this.config.risk.maxRiskScore) {
			reasons.push(
				`bid risk ${bid.riskScore.toFixed(2)} exceeds risk limit ${this.config.risk.maxRiskScore.toFixed(2)}`,
			)
		}
		if (bid.qualityScore < this.config.risk.minQualityScore) {
			reasons.push(
				`bid quality ${bid.qualityScore.toFixed(2)} below minimum ${this.config.risk.minQualityScore.toFixed(2)}`,
			)
		}

		return {
			allowed: reasons.length === 0,
			reasons,
		}
	}
}
