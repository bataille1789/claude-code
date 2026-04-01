import { expect, test } from 'bun:test'
import { PolicyEngine } from '../policyEngine.js'
import type { Bid, GatewayConfig, GatewayTask } from '../types.js'

const baseTask: GatewayTask = {
	id: 't1',
	title: 'task',
	description: 'desc',
	requiredCapabilities: ['analyze'],
	expectedValue: 10,
	urgency: 0.5,
	maxBudgetUsd: 1,
	maxLatencyMs: 1_000,
	allowedTools: ['Read'],
	allowedScopes: ['read'],
}

const config: GatewayConfig = {
	eventLogPath: '/tmp/test-events.jsonl',
	risk: {
		maxRiskScore: 0.5,
		minQualityScore: 0.3,
	},
	agents: [],
}

test('policy blocks overpriced bid', () => {
	const policy = new PolicyEngine(config)
	const bid: Bid = {
		taskId: 't1',
		agentId: 'a1',
		estimatedCostUsd: 3,
		estimatedLatencyMs: 500,
		confidence: 0.8,
		qualityScore: 0.9,
		riskScore: 0.1,
		utilityScore: 0,
		rationale: '',
	}

	const result = policy.evaluateBid(baseTask, bid)
	expect(result.allowed).toBe(false)
	expect(result.reasons.join(' ')).toContain('exceeds max budget')
})
