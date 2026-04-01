export type AgentCapability = 'analyze' | 'implement' | 'test' | 'review' | 'plan' | 'ops'

export type PermissionScope = 'read' | 'edit' | 'exec' | 'network'

export type GatewayTask = {
	id: string
	title: string
	description: string
	requiredCapabilities: AgentCapability[]
	expectedValue: number
	urgency: number
	maxBudgetUsd: number
	maxLatencyMs: number
	allowedTools: string[]
	allowedScopes: PermissionScope[]
	metadata?: Record<string, unknown>
}

export type AgentProfile = {
	id: string
	provider: 'claude' | 'gemini' | 'copilot' | 'codex' | 'custom'
	capabilities: AgentCapability[]
	baseCostPer1kTokensUsd: number
	historicalQuality: number
	riskScore: number
	maxParallelTasks: number
	command: string
	args?: string[]
	env?: Record<string, string>
}

export type Bid = {
	taskId: string
	agentId: string
	estimatedCostUsd: number
	estimatedLatencyMs: number
	confidence: number
	qualityScore: number
	riskScore: number
	utilityScore: number
	rationale: string
}

export type AllocationDecision = {
	taskId: string
	winnerAgentId: string
	winningBid: Bid
	rejectedBids: Bid[]
	clearingPriceUsd: number
}

export type PolicyDecision = {
	allowed: boolean
	reasons: string[]
}

export type GatewayEvent =
	| {
			type: 'task_received'
			at: string
			task: GatewayTask
	  }
	| {
			type: 'bid_received'
			at: string
			bid: Bid
	  }
	| {
			type: 'allocation_decided'
			at: string
			decision: AllocationDecision
	  }
	| {
			type: 'task_executed'
			at: string
			taskId: string
			agentId: string
			output: string
	  }
	| {
			type: 'policy_blocked'
			at: string
			taskId: string
			reasons: string[]
	  }

export type GatewayConfig = {
	eventLogPath: string
	agents: AgentProfile[]
	risk: {
		maxRiskScore: number
		minQualityScore: number
	}
	claudeBridge?: {
		enabled: boolean
		teamName?: string
		leaderName?: string
		mirrorToTasks?: boolean
		mirrorToMailbox?: boolean
	}
}
