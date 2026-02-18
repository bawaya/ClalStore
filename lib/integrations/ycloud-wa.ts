// =====================================================
// ClalMobile — yCloud WhatsApp Provider (Hub Adapter)
// Wraps S4 whatsapp.ts into provider interface
// =====================================================

import type { WhatsAppProvider } from "./hub";
import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppTemplate } from "@/lib/bot/whatsapp";

export class YCloudWhatsAppProvider implements WhatsAppProvider {
  name = "yCloud";

  async sendText(to: string, text: string) {
    try {
      await sendWhatsAppText(to, text);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  async sendButtons(to: string, text: string, buttons: { id: string; title: string }[]) {
    try {
      await sendWhatsAppButtons(to, text, buttons);
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  async sendTemplate(to: string, templateName: string, params: string[]) {
    try {
      await sendWhatsAppTemplate(to, templateName, params);
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}
