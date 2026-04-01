import { expect, test } from 'bun:test'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ClaudeSwarmBridge } from '../bridges/claudeSwarmBridge.js'
import type { AllocationDecision, GatewayTask } from '../types.js'

test('bridge mirrors to task and mailbox files', async () => {
	const baseDir = await mkdtemp(join(tmpdir(), 'gateway-bridge-test-'))
	process.env.CLAUDE_CONFIG_DIR = baseDir

	const bridge = new ClaudeSwarmBridge({
		enabled: true,
		teamName: 'unit-team',
		leaderName: 'team-lead',
		mirrorToTasks: true,
		mirrorToMailbox: true,
	})

	const task: GatewayTask = {
		id: 'gt-1',
		title: 'Bridge test',
		description: 'Bridge test description',
		requiredCapabilities: ['analyze'],
		expectedValue: 10,
		urgency: 0.5,
		maxBudgetUsd: 2,
		maxLatencyMs: 10_000,
		allowedTools: ['TaskCreate'],
		allowedScopes: ['read'],
	}

	await bridge.onTaskReceived(task)

	const decision: AllocationDecision = {
		taskId: task.id,
		winnerAgentId: 'claude-runner',
		winningBid: {
			taskId: task.id,
			agentId: 'claude-runner',
			estimatedCostUsd: 0.1,
			estimatedLatencyMs: 100,
			confidence: 0.9,
			qualityScore: 0.9,
			riskScore: 0.1,
			utilityScore: 5,
			rationale: 'ok',
		},
		rejectedBids: [],
		clearingPriceUsd: 0.1,
	}

	await bridge.onAllocation(task, decision)
	await bridge.onExecution(task.id, 'done', 'claude-runner')

	const mirroredTask = await readFile(join(baseDir, 'tasks', 'unit-team', '1.json'), 'utf8')
	expect(mirroredTask).toContain('"status": "completed"')

	const leaderInbox = await readFile(
		join(baseDir, 'teams', 'unit-team', 'inboxes', 'team-lead.json'),
		'utf8',
	)
	expect(leaderInbox).toContain('Allocated')
	expect(leaderInbox).toContain('Completed')
})
