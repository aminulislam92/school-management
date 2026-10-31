import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getTenantHost, schoolDefaultLocale } from "@/lib/tenant";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./config";

// next-intl loads this on every request. The language comes from a cookie
// (not the URL), because the URL is already used for the school subdomain.
// Reading cookies is runtime data, so anything that uses translations must
// render inside <Suspense> (the root layout does this once for all pages).
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  // No choice made yet on this browser → the school's own default language.
  const schoolLocale = cookieLocale ? null : await schoolDefaultLocale(await getTenantHost());
  const locale = isLocale(cookieLocale) ? cookieLocale : isLocale(schoolLocale) ? schoolLocale : defaultLocale;

  return {
    locale,
    timeZone: "Asia/Dhaka",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
