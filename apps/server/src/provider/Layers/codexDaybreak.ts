import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import type { CodexAppServerError } from "effect-codex-app-server/errors";
import type * as CodexSchema from "effect-codex-app-server/schema";

const VerifiedAccess = Schema.Struct({
  programs: Schema.Array(Schema.Unknown),
});
const CyberAccess = Schema.Struct({
  program: Schema.Literal("cyber"),
  state: Schema.Literals(["active", "inactive", "unavailable"]),
  grants: Schema.Array(
    Schema.Struct({
      level: Schema.Literals(["tac1", "tac2", "tac3", "government"]),
      source: Schema.Literals(["individual", "organization"]),
    }),
  ),
});
const AuthClaims = Schema.Struct({
  "https://api.openai.com/auth": Schema.Struct({ chatgpt_account_id: Schema.NonEmptyString }),
});

const isVerifiedAccess = Schema.is(VerifiedAccess);
const isCyberProgram = Schema.is(Schema.Struct({ program: Schema.Literal("cyber") }));
const isCyberAccess = Schema.is(CyberAccess);
const decodeAuthClaims = Schema.decodeEffect(Schema.fromJsonString(AuthClaims));

export function hasCodexDaybreakAccess(value: unknown): boolean {
  if (!isVerifiedAccess(value)) return false;
  const programs = value.programs.filter(isCyberProgram);
  const program = programs[0];
  return (
    programs.length === 1 &&
    isCyberAccess(program) &&
    program.state === "active" &&
    program.grants.length > 0
  );
}

export function supportsCodexDaybreak(version: string | undefined): boolean {
  const match = version?.match(/^(\d+)\.(\d+)\.(\d+)(?:$|-)/);
  return match !== undefined && match !== null && (Number(match[1]) > 0 || Number(match[2]) >= 155);
}

/** Use the probed instance's credentials, never another CODEX_HOME's auth file. */
export const readCodexDaybreakEligibility = Effect.fn("readCodexDaybreakEligibility")(
  function* (input: {
    readonly readAuthStatus: Effect.Effect<CodexSchema.GetAuthStatusResponse, CodexAppServerError>;
    readonly readConfig: Effect.Effect<CodexSchema.V2ConfigReadResponse, CodexAppServerError>;
  }) {
    const auth = yield* input.readAuthStatus;
    if (auth.authMethod !== "chatgpt" || !auth.authToken) return false;
    const claims = yield* decodeAuthClaims(
      Buffer.from(auth.authToken.split(".")[1] ?? "", "base64url").toString("utf8"),
    );
    const accountId = claims["https://api.openai.com/auth"].chatgpt_account_id;
    const { config } = yield* input.readConfig;
    const baseUrl =
      typeof config.chatgpt_base_url === "string"
        ? config.chatgpt_base_url.replace(/\/$/, "")
        : "https://chatgpt.com/backend-api";
    const accessUrl = URL.parse(`${baseUrl}/accounts/verified_access`);
    if (accessUrl?.protocol !== "https:") return false;
    const http = yield* HttpClient.HttpClient;
    const response = yield* http
      .get(accessUrl, {
        headers: { Authorization: `Bearer ${auth.authToken}`, "ChatGPT-Account-Id": accountId },
      })
      .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
    const access = yield* response.json;
    const current = yield* input.readAuthStatus;
    return (
      current.authMethod === "chatgpt" &&
      current.authToken === auth.authToken &&
      hasCodexDaybreakAccess(access)
    );
  },
  Effect.timeout("3 seconds"),
  Effect.catch(() =>
    // Request errors may contain authorization headers. Do not log their payloads.
    Effect.logDebug("Codex Daybreak eligibility could not be verified.").pipe(Effect.as(false)),
  ),
);
