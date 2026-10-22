import assert from "node:assert/strict";
import test from "node:test";
import { browserRedirect, fetchPublicPage, publicAddress, publicBrowserUrl, publicTarget } from "./browser-security.ts";

test("browser rejects private, loopback, metadata, mapped IPv6, and reserved addresses", () => {
  for (const address of ["127.0.0.1", "10.2.3.4", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "192.0.2.1", "224.0.0.1"]) {
    assert.equal(publicAddress(address), false, address);
  }
  assert.equal(publicAddress("93.184.216.34"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
});

test("browser URL validation rejects alternative protocols, ports, credentials, and numeric loopback", () => {
  for (const url of ["file:///etc/passwd", "javascript:alert(1)", "https://example.com:8443", "https://user:pass@example.com", "http://localhost", "http://machine.local", "http://2130706433", "http://0x7f000001", "http://[::1]"]) {
    assert.throws(() => publicBrowserUrl(url), url);
  }
  assert.equal(publicBrowserUrl("https://example.com/page#section").href, "https://example.com/page");
});

test("DNS results must all be public and the selected address is retained for connection pinning", async () => {
  await assert.rejects(publicTarget("https://example.com", async () => [{ address: "127.0.0.1", family: 4 }]));
  await assert.rejects(publicTarget("https://example.com", async () => [
    { address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 },
  ]));
  const target = await publicTarget("https://example.com", async () => [{ address: "93.184.216.34", family: 4 }]);
  assert.equal(target.address.address, "93.184.216.34");
});

test("redirects cannot leave the approved host or downgrade HTTPS", () => {
  const original = new URL("https://example.com/start");
  assert.equal(browserRedirect(original, "/article").href, "https://example.com/article");
  assert.throws(() => browserRedirect(original, "http://example.com/article"));
  assert.throws(() => browserRedirect(original, "https://other.example/article"));
  assert.throws(() => browserRedirect(original, "http://127.0.0.1"));
});

test("cancelled and private page requests fail before opening a connection", async () => {
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(fetchPublicPage("https://example.com", abort.signal));
  await assert.rejects(fetchPublicPage("http://127.0.0.1", new AbortController().signal));
});