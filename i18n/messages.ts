import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";
import es from "@/messages/es.json";
import type {Locale} from "./routing";

export const messages: Record<Locale, typeof en> = {en, ar, fr, es};

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}

