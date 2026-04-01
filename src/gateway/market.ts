import type { Bid, GatewayTask } from './types.js'

/**
 * Utility = expected value capture - explicit penalties.
 * This makes allocation deterministic and auditable.
 */
export function scoreBid(task: GatewayTask, bid: Bid): Bid {
	const valueCapture = task.expectedValue * bid.confidence * bid.qualityScore
	const costPenalty = bid.estimatedCostUsd
	const latencyPenalty = (Math.max(bid.estimatedLatencyMs - task.maxLatencyMs, 0) / 1000) * 0.05
	const riskPenalty = bid.riskScore * task.expectedValue * 0.15

	const utilityScore = valueCapture - costPenalty - latencyPenalty - riskPenalty

	return {
		...bid,
		utilityScore,
	}
}

/**
 * Second-price style clearing:
 * - winner pays max(own reserve, second-best ask)
 * - helps reduce strategic overbidding pressure.
 */
export function clearingPrice(winner: Bid, allScored: Bid[]): number {
	const sorted = [...allScored].sort((a, b) => b.utilityScore - a.utilityScore)
	const secondBest = sorted[1]
	if (!secondBest) return winner.estimatedCostUsd
	return Math.max(winner.estimatedCostUsd, secondBest.estimatedCostUsd)
}
