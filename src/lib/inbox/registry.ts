import { facebook } from "./adapters/facebook";
import { instagram } from "./adapters/instagram";
import { whatsapp } from "./adapters/whatsapp";
import { viber } from "./adapters/viber";
import { ChannelError, type ChannelAdapter } from "./types";
const adapters: Record<string, ChannelAdapter> = { FACEBOOK: facebook, INSTAGRAM: instagram, WHATSAPP: whatsapp, VIBER: viber };
export function adapter(type: string) {
  const result = adapters[type]; if (!result) throw new ChannelError("CHANNEL_NOT_IMPLEMENTED");
  return result;
}
