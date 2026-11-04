import type { ChannelAdapter } from "../types";
import { verifyMeta, parseMeta, sendMeta, metaProfile, checkMeta, metaMedia } from "./meta-shared";
export const facebook: ChannelAdapter = {
  type: "FACEBOOK", verifyWebhook: verifyMeta, parseIncoming: body => parseMeta(body, "FACEBOOK"),
  sendMessage: sendMeta, fetchProfile: metaProfile, checkConnection: checkMeta, resolveMedia: metaMedia,
};
