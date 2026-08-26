import { EventEmitter } from 'node:events'

export type SendNotification = {
  id: number
  workspaceId: string
  workspaceName: string
  to: string
  at: number
}

// Single self-hosted process — an in-memory emitter is enough to push a live
// "delivered" event to the admin UI without adding a queue/pubsub dependency.
const g = globalThis as { __notifyBus?: EventEmitter }
export const notifyBus = (g.__notifyBus ??= new EventEmitter().setMaxListeners(50))

export function notifySent(payload: SendNotification) {
  notifyBus.emit('sent', payload)
}
