import createMiddleware from "next-intl/middleware";
import {NextRequest} from "next/server";
import {hasLocale} from "next-intl";
import Negotiator from "negotiator";
import {routing} from "./i18n/routing";

const handleRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const prefix = request.nextUrl.pathname.split("/")[1];
  if (hasLocale(routing.locales, prefix)) return handleRouting(request);

  // Honor browser priority: ar-MA must win over a lower-priority exact French match.
  const languages = new Negotiator({headers: {
    "accept-language": request.headers.get("accept-language") ?? "",
  }}).languages();
  const preferred = languages.map((language) => language.split("-")[0].toLowerCase())
    .find((language) => hasLocale(routing.locales, language)) ?? routing.defaultLocale;
  const headers = new Headers(request.headers);
  headers.set("accept-language", preferred);
  return handleRouting(new NextRequest(request, {headers}));
}

export const config = {
  matcher: ["/((?!api(?:/|$)|_next(?:/|$)|_vercel(?:/|$)|.*\\..*).*)"],
};

