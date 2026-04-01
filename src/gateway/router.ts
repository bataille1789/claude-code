import type { AgentAdapter } from './adapters/Adapter.js'
import { clearingPrice, scoreBid } from './market.js'
import type { PolicyEngine } from './policyEngine.js'
import type { AllocationDecision, Bid, GatewayTask } from './types.js'

export class Router {
	constructor(
		private readonly adapters: AgentAdapter[],
		private readonly policyEngine: PolicyEngine,
	) {}

	async allocate(task: GatewayTask): Promise<AllocationDecision> {
		const rawBids = await Promise.all(this.adapters.map((adapter) => adapter.getBid(task)))
		const scoredBids = rawBids.map((bid) => scoreBid(task, bid))

		const allowed: Bid[] = []
		const rejected: Bid[] = []

		for (const bid of scoredBids) {
			const policy = this.policyEngine.evaluateBid(task, bid)
			if (policy.allowed) {
				allowed.push(bid)
			} else {
				rejected.push({
					...bid,
					rationale: `${bid.rationale}; policy_reject=${policy.reasons.join(' | ')}`,
				})
			}
		}

		if (allowed.length === 0) {
			const richestReject = rejected.sort((a, b) => b.utilityScore - a.utilityScore)[0] ?? null
			throw new Error(
				`No policy-compliant bids for task=${task.id}. best_reject=${richestReject?.rationale ?? 'none'}`,
			)
		}

		const sorted = [...allowed].sort((a, b) => b.utilityScore - a.utilityScore)
		const winner = sorted[0]
		const price = clearingPrice(winner, sorted)

		return {
			taskId: task.id,
			winnerAgentId: winner.agentId,
			winningBid: winner,
			rejectedBids: rejected,
			clearingPriceUsd: price,
		}
	}
}
