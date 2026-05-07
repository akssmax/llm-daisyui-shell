import { memo, useCallback } from "react"
import type { UIMessage } from "ai"

import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
} from "@/components/ai-elements/message"
import {
  Attachment,
  AttachmentPreview,
  Attachments,
} from "@/components/ai-elements/attachments"
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation"

import { getMessageText } from "@/lib/chat-message-utils"
import type { MockChatItem } from "@/lib/mock-chat-data"

export type ChatMessageRowProps = {
  item: MockChatItem
  branchIndex: number
  branchCount: number
  onBranchChange: (messageId: string, branch: number) => void
}

function ChatMessageRowInner({
  item,
  branchIndex,
  branchCount,
  onBranchChange,
}: ChatMessageRowProps) {
  const msg = item.message
  const meta = item.meta

  const handleBranchChange = useCallback(
    (next: number) => {
      onBranchChange(item.id, next)
    },
    [item.id, onBranchChange]
  )

  const messageBody = (
    <div className="space-y-2">
      {meta?.attachments?.length ? (
        <Attachments variant="grid">
          {meta.attachments.map((attachment) => (
            <Attachment key={attachment.id} data={attachment}>
              <AttachmentPreview />
            </Attachment>
          ))}
        </Attachments>
      ) : null}

      <MessageContent>{getMessageText(msg)}</MessageContent>

      {meta?.citations?.length ? (
        <InlineCitation>
          {meta.citations.map((c) => (
            <InlineCitationCard key={c.href}>
              <InlineCitationCardTrigger sources={[c.href]} />
              <InlineCitationCardBody>
                <InlineCitationSource
                  title={c.label}
                  url={c.href}
                  description="Citation"
                />
              </InlineCitationCardBody>
            </InlineCitationCard>
          ))}
        </InlineCitation>
      ) : null}

    </div>
  )

  return (
    <MessageBranch defaultBranch={branchIndex} onBranchChange={handleBranchChange}>
      <MessageBranchContent>
        <Message from={msg.role as UIMessage["role"]}>{messageBody}</Message>
      </MessageBranchContent>

      {branchCount > 1 ? (
        <MessageBranchSelector className="px-0">
          <MessageBranchPrevious />
          <MessageBranchPage />
          <MessageBranchNext />
        </MessageBranchSelector>
      ) : null}
    </MessageBranch>
  )
}

export const ChatMessageRow = memo(ChatMessageRowInner)
