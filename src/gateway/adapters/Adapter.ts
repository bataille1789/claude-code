import type { Bid, GatewayTask } from '../types.js'

export interface AgentAdapter {
	readonly id: string
	getBid(task: GatewayTask): Promise<Bid>
	execute(task: GatewayTask): Promise<string>
}
