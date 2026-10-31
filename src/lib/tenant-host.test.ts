import { describe, expect, it } from "vitest";
import { isValidSchoolCode, resolveTenantHost } from "./tenant-host";

describe("resolveTenantHost — development (root = localhost)", () => {
  const root = "localhost";

  it.each([
    ["localhost:3000", { kind: "root" }],
    ["127.0.0.1:3000", { kind: "root" }],
    ["192.168.0.104:3000", { kind: "root" }],
    ["demo.localhost:3000", { kind: "subdomain", code: "demo" }],
    ["DEMO.Localhost:3000", { kind: "subdomain", code: "demo" }],
    ["www.localhost:3000", { kind: "root" }],
    ["api.localhost:3000", { kind: "root" }],
  ])("%s", (host, expected) => {
    expect(resolveTenantHost(host, root)).toEqual(expected);
  });
});

describe("resolveTenantHost — production (root = yourapp.com)", () => {
  const root = "yourapp.com";

  it.each([
    ["yourapp.com", { kind: "root" }],
    ["www.yourapp.com", { kind: "root" }],
    ["ideal-school.yourapp.com", { kind: "subdomain", code: "ideal-school" }],
    ["a.b.yourapp.com", { kind: "root" }], // nested subdomains are not schools
    ["-bad-.yourapp.com", { kind: "root" }],
    ["abcschool.edu.bd", { kind: "custom", domain: "abcschool.edu.bd" }],
    ["www.abcschool.edu.bd", { kind: "custom", domain: "abcschool.edu.bd" }],
    ["abcschool.edu.bd.", { kind: "custom", domain: "abcschool.edu.bd" }],
    ["notyourapp.com", { kind: "custom", domain: "notyourapp.com" }],
  ])("%s", (host, expected) => {
    expect(resolveTenantHost(host, root)).toEqual(expected);
  });

  it("treats a missing host as root", () => {
    expect(resolveTenantHost(null, root)).toEqual({ kind: "root" });
  });
});

describe("isValidSchoolCode", () => {
  it.each(["demo", "ideal-school", "school123", "ab"])("accepts %s", (code) => {
    expect(isValidSchoolCode(code)).toBe(true);
  });

  it.each(["a", "Demo", "my_school", "-demo", "demo-", "www", "api", "x".repeat(41)])(
    "rejects %s",
    (code) => {
      expect(isValidSchoolCode(code)).toBe(false);
    },
  );
});
