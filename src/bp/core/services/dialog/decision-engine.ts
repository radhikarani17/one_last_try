import { IO, Logger } from 'botpress/sdk'
import { WellKnownFlags } from 'core/sdk/enums'
import { TYPES } from 'core/types'
import { inject, injectable } from 'inversify'
import _ from 'lodash'

import { EventEngine } from '../middleware/event-engine'
import { StateManager } from '../middleware/state-manager'

import { DialogEngine } from './dialog-engine'

@injectable()
export class DecisionEngine {
  constructor(
    @inject(TYPES.Logger) private logger: Logger,
    @inject(TYPES.DialogEngine) private dialogEngine: DialogEngine,
    @inject(TYPES.EventEngine) private eventEngine: EventEngine,
    @inject(TYPES.StateManager) private stateManager: StateManager
  ) {}

  private readonly MIN_CONFIDENCE = process.env.BP_DECISION_MIN_CONFIENCE || 0.3

  public async processEvent(sessionId: string, event: IO.IncomingEvent) {
    const isInMiddleOfFlow = _.get(event, 'state.context.currentFlow', false)

    if (event.suggestions && !isInMiddleOfFlow) {
      const bestReply = this._findBestReply(event)
      if (bestReply) {
        await this._sendSuggestion(bestReply, sessionId, event)
      }
    }

    if (!event.hasFlag(WellKnownFlags.SKIP_DIALOG_ENGINE)) {
      const processedEvent = await this.dialogEngine.processEvent(sessionId, event)
      await this.stateManager.persist(processedEvent, false)
    }
  }

  protected _findBestReply(event: IO.IncomingEvent): IO.Suggestion | undefined {
    const replies = _.sortBy(event.suggestions, reply => -reply.confidence)
    const lastMsg = _.last(event.state.session.lastMessages)

    // If the user asks the same question, chances are he didnt get the response he wanted.
    // So we cycle through the other suggestions and return the next best reply with a high enough confidence.
    for (let i = 0; i < replies.length; i++) {
      const bestReplyIntent = replies[i].intent
      const lastMessageIntent = lastMsg && lastMsg.intent

      if (bestReplyIntent === lastMessageIntent) {
        const nextBestReply = replies[i + 1]

        if (this._isConfidentReply(nextBestReply)) {
          return nextBestReply
        } else {
          return // If confidence is too low, we dont need to check other replies
        }
      }
    }

    const bestReply = replies[0]
    if (this._isConfidentReply(bestReply)) {
      return bestReply
    }
    return
  }

  private _isConfidentReply(reply) {
    return reply && reply.confidence > this.MIN_CONFIDENCE
  }

  private async _sendSuggestion(reply, sessionId, event) {
    const payloads = _.filter(reply.payloads, p => p.type !== 'redirect')
    if (payloads) {
      await this.eventEngine.replyToEvent(event, payloads)

      const message: IO.MessageHistory = {
        intent: reply.intent,
        user: event.preview,
        reply: _.find(payloads, p => p.text != undefined)
      }
      event.state.session.lastMessages.push(message)

      await this.stateManager.persist(event, true)
    }

    const redirect = _.find(reply.payloads, p => p.type === 'redirect')
    if (redirect && redirect.flow && redirect.node) {
      await this.dialogEngine.jumpTo(sessionId, event, redirect.flow, redirect.node)
    } else {
      event.setFlag(WellKnownFlags.SKIP_DIALOG_ENGINE, true)
    }
  }
}
