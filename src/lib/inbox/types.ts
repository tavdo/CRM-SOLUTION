export const channelTypes = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "VIBER"] as const;
export type ChannelType = typeof channelTypes[number];
export type Credentials = { accessToken: string; appSecret?: string; verifyToken?: string };
export type MediaSource = { url?: string; mediaId?: string; name: string; type: string };
export type IncomingEvent = {
  kind: "message"; accountId: string; channelType: ChannelType; chatId: string;
  messageId: string; at: Date; text?: string; type: string; echo?: boolean;
  name?: string; avatar?: string; phone?: string; media: MediaSource[];
  payload?: Record<string, unknown>;
};
export type StatusEvent = {
  kind: "status"; accountId: string; channelType: ChannelType; chatId?: string;
  messageIds: string[]; watermark?: Date; status: "DELIVERED" | "READ" | "FAILED" | "SENT";
};
export type SubscriptionEvent = { kind: "subscription"; accountId: string; channelType: ChannelType; chatId: string; subscribed: boolean };
export type ChannelEvent = IncomingEvent | StatusEvent | SubscriptionEvent;
export type OutgoingMessage = { text: string; type: string; payload?: Record<string, unknown> };
export type SendContext = { accountId: string; chatId: string; credentials: Credentials; lastIncomingAt: Date | null; subscribed: boolean };
export interface ChannelAdapter {
  type: ChannelType;
  verifyWebhook(raw: string, signature: string | null, secret: string): boolean;
  parseIncoming(body: unknown, accountId?: string): ChannelEvent[];
  sendMessage(ctx: SendContext, message: OutgoingMessage): Promise<string>;
  fetchProfile(ctx: SendContext): Promise<{ name?: string; avatar?: string; phone?: string }>;
  checkConnection(accountId: string, credentials: Credentials): Promise<void>;
  resolveMedia(source: MediaSource, credentials: Credentials): Promise<{ url: string; authorization?: string }>;
}

export class ChannelError extends Error {
  constructor(public code: string, public retryable = false, public ambiguous = false) { super(code); }
}
