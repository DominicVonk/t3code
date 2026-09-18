import { assert, it, afterEach, vi } from "@effect/vitest";
import { FetchHttpClient } from "effect/unstable/http";
import * as Effect from "effect/Effect";

import {
  hasCodexDaybreakAccess,
  readCodexDaybreakEligibility as readEligibility,
  supportsCodexDaybreak,
} from "./codexDaybreak.ts";

const readCodexDaybreakEligibility = (input: Parameters<typeof readEligibility>[0]) =>
  readEligibility(input).pipe(
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }),
    Effect.provide(FetchHttpClient.layer),
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

afterEach(() => vi.unstubAllGlobals());

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
    vi.stubGlobal("fetch", fetchMock);
    assert.equal(yield* readCodexDaybreakEligibility(input), true);
    const [url, options] = fetchMock.mock.calls[0]!;
    assert.equal(url, "https://chatgpt.com/backend-api/accounts/verified_access");
    assert.equal(new Headers(options?.headers).get("authorization"), `Bearer ${token}`);
    assert.equal(new Headers(options?.headers).get("chatgpt-account-id"), "account-1");
    assert.equal(options?.redirect, "error");
  }),
);

it.effect("rejects results belonging to an account that changed during discovery", () =>
  Effect.gen(function* () {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(granted)));
    let reads = 0;
    assert.equal(
      yield* readCodexDaybreakEligibility({
        ...input,
        readAuthStatus: Effect.sync(() =>
          ++reads === 1 ? auth : { ...auth, authToken: "another-account-token" },
        ),
      }),
      false,
    );
  }),
);

it.effect("does not probe API keys or send malformed credentials", () =>
  Effect.gen(function* () {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    for (const status of [
      { ...auth, authMethod: "apikey" },
      { ...auth, authToken: null },
      { ...auth, authToken: "invalid" },
    ]) {
      assert.equal(
        yield* readCodexDaybreakEligibility({ ...input, readAuthStatus: Effect.succeed(status) }),
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
      vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(response));
      assert.equal(yield* readCodexDaybreakEligibility(input), false);
    }
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")));
    assert.equal(yield* readCodexDaybreakEligibility(input), false);
  }),
);
