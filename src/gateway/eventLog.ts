import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { GatewayEvent } from './types.js'

export class EventLog {
	constructor(private readonly path: string) {}

	async append(event: GatewayEvent): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true })
		await appendFile(this.path, `${JSON.stringify(event)}\n`, 'utf8')
	}
}
