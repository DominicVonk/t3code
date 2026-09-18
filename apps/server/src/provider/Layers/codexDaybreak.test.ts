import { assert, it, vi } from "@effect/vitest";
import { FetchHttpClient } from "effect/unstable/http";
import * as Effect from "effect/Effect";

import {
  hasCodexDaybreakAccess,
  readCodexDaybreakEligibility as readEligibility,
  supportsCodexDaybreak,
} from "./codexDaybreak.ts";

const readCodexDaybreakEligibility = (
  input: Parameters<typeof readEligibility>[0],
  fetch: typeof globalThis.fetch,
) =>
  readEligibility(input).pipe(
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }),
    Effect.provide(FetchHttpClient.layer),
    Effect.provideService(FetchHttpClient.Fetch, fetch),
  );

const granted = {
  programs: [
    { program: "cyber", state: "active", grants: [{ level: "tac1", source: "individual" }] },
  ],
};
const token = `header.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "account-1" } })).toString("base64url")}.signature`;
const auth = { authMethod: "chatgpt", authToken: token, requiresOpenaiAuth: true };
const input = {
  readAuthStatus: Effect.succeed(auth),
  readConfig: Effect.succeed({ config: {}, origins: {} }),
};

it("requires an active recognized grant and handles unknown or malformed access conservatively", () => {
  assert.equal(hasCodexDaybreakAccess(granted), true);
  assert.equal(
    hasCodexDaybreakAccess({ programs: [{ program: "other" }, ...granted.programs] }),
    true,
  );
  for (const value of [
    null,
    {},
    { programs: [] },
    { programs: [granted.programs[0], granted.programs[0]] },
    ...["inactive", "unavailable", "unexpected"].map((state) => ({
      programs: [{ ...granted.programs[0], state }],
    })),
    { programs: [{ ...granted.programs[0], grants: [] }] },
    {
      programs: [{ ...granted.programs[0], grants: [{ level: "unknown", source: "individual" }] }],
    },
  ])
    assert.equal(hasCodexDaybreakAccess(value), false);
});

it("gates the experimental option on Codex 0.155 or newer", () => {
  for (const version of ["0.155.0", "0.155.0-alpha.1", "0.156.0", "1.0.0"])
    assert.equal(supportsCodexDaybreak(version), true);
  for (const version of [undefined, "unknown", "0.154.0", "0.99.0"])
    assert.equal(supportsCodexDaybreak(version), false);
});

it.effect("checks the selected account and returns only its eligibility", () =>
  Effect.gen(function* () {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(granted));
    assert.equal(yield* readCodexDaybreakEligibility(input, fetchMock), true);
    const [url, options] = fetchMock.mock.calls[0]!;
    assert.equal(url, "https://chatgpt.com/backend-api/accounts/verified_access");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${token}`);
    assert.equal(new Headers(options?.headers).get("chatgpt-account-id"), "account-1");
    assert.equal(options?.redirect, "error");
  }),
);

it.effect("rejects results belonging to an account that changed during discovery", () =>
  Effect.gen(function* () {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(granted));
    let reads = 0;
    assert.equal(
      yield* readCodexDaybreakEligibility(
        {
          ...input,
          readAuthStatus: Effect.sync(() =>
            ++reads === 1 ? auth : { ...auth, authToken: "another-account-token" },
          ),
        },
        fetchMock,
      ),
      false,
    );
  }),
);

it.effect("does not probe API keys or send malformed credentials", () =>
  Effect.gen(function* () {
    const fetchMock = vi.fn<typeof fetch>();
    for (const status of [
      { ...auth, authMethod: "apikey" },
      { ...auth, authToken: null },
      { ...auth, authToken: "invalid" },
    ]) {
      assert.equal(
        yield* readCodexDaybreakEligibility(
          { ...input, readAuthStatus: Effect.succeed(status) },
          fetchMock,
        ),
        false,
      );
    }
    assert.equal(fetchMock.mock.calls.length, 0);
  }),
);

it.effect("unavailable access checks leave ordinary Codex discovery usable", () =>
  Effect.gen(function* () {
    for (const response of [
      new Response("denied", { status: 403 }),
      Response.json({ programs: [] }),
      new Response("invalid json"),
    ]) {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
      assert.equal(yield* readCodexDaybreakEligibility(input, fetchMock), false);
    }
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    assert.equal(yield* readCodexDaybreakEligibility(input, fetchMock), false);
  }),
);

it.effect("rejects insecure and malformed base URLs before sending credentials", () =>
  Effect.gen(function* () {
    const fetchMock = vi.fn<typeof fetch>();
    for (const chatgpt_base_url of [
      "http://example.com/backend-api",
      "http://localhost:8000",
      "ftp://example.com",
      "not a url",
      "",
    ]) {
      assert.equal(
        yield* readCodexDaybreakEligibility(
          {
            ...input,
            readConfig: Effect.succeed({ config: { chatgpt_base_url }, origins: {} }),
          },
          fetchMock,
        ),
        false,
      );
    }
    assert.equal(fetchMock.mock.calls.length, 0);
  }),
);

it.effect("preserves configured HTTPS base URLs", () =>
  Effect.gen(function* () {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(granted));
    assert.equal(
      yield* readCodexDaybreakEligibility(
        {
          ...input,
          readConfig: Effect.succeed({
            config: { chatgpt_base_url: "https://example.com/custom-api/" },
            origins: {},
          }),
        },
        fetchMock,
      ),
      true,
    );
    const [url, options] = fetchMock.mock.calls[0]!;
    assert.equal(url, "https://example.com/custom-api/accounts/verified_access");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${token}`);
    assert.equal(options?.redirect, "error");
  }),
);
