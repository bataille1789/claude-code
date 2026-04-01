import type { AgentProfile, Bid, GatewayTask } from './types.js'

/**
 * Claude-specific strengths booster:
 * - rewards planning/review-heavy work where Claude Code's native tools
 *   (tasks/mailbox/plan-mode) are strongest.
 */
export function applyProviderStrengthBoost(
	task: GatewayTask,
	profile: AgentProfile,
	bid: Bid,
): Bid {
	if (profile.provider !== 'claude') {
		return bid
	}

	const planningOrReviewHeavy =
		task.requiredCapabilities.includes('plan') || task.requiredCapabilities.includes('review')

	const toolRichTask = task.allowedTools.some((tool) =>
		['TaskCreate', 'TaskUpdate', 'SendMessage', 'ExitPlanMode'].includes(tool),
	)

	const boost = planningOrReviewHeavy || toolRichTask ? 0.08 : 0

	if (boost === 0) return bid

	return {
		...bid,
		confidence: Math.min(1, bid.confidence + boost),
		qualityScore: Math.min(1, bid.qualityScore + boost),
		rationale: `${bid.rationale}; claude_strength_boost=${boost.toFixed(2)}`,
	}
}
