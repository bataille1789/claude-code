import { expect, test } from 'bun:test'
import { scoreBid } from '../market.js'
import type { Bid, GatewayTask } from '../types.js'

test('scoreBid computes deterministic utility', () => {
	const task: GatewayTask = {
		id: 't1',
		title: 'task',
		description: 'desc',
		requiredCapabilities: ['analyze', 'implement'],
		expectedValue: 10,
		urgency: 0.5,
		maxBudgetUsd: 2,
		maxLatencyMs: 10_000,
		allowedTools: ['Read'],
		allowedScopes: ['read'],
	}

	const bid: Bid = {
		taskId: 't1',
		agentId: 'a1',
		estimatedCostUsd: 0.5,
		estimatedLatencyMs: 8_000,
		confidence: 0.8,
		qualityScore: 0.9,
		riskScore: 0.1,
		utilityScore: 0,
		rationale: 'baseline',
	}

	const scored = scoreBid(task, bid)
	expect(scored.utilityScore).toBeCloseTo(6.55, 4)
})
