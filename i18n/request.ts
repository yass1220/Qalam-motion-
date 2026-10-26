import * as rootParams from "next/root-params";
import {notFound} from "next/navigation";
import {hasLocale} from "next-intl";
import {getRequestConfig} from "next-intl/server";
import {routing} from "./routing";
import {messages} from "./messages";

export default getRequestConfig(async ({locale}) => {
  const candidate = locale ?? await rootParams.locale();
  if (!hasLocale(routing.locales, candidate)) notFound();
  return {locale: candidate, messages: messages[candidate], timeZone: "UTC"};
});

