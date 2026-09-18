import { assert, it } from "@effect/vitest";

import { ProviderInstanceId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";

import {
  getCodexServiceTierOptionValue,
  getCodexCyberAccessProgramOptionValue,
} from "./codexModelOptions.ts";

it("returns the selected Codex service tier id", () => {
  const selection = createModelSelection(ProviderInstanceId.make("codex"), "gpt-5.5", [
    { id: "serviceTier", value: "flex" },
  ]);

  assert.equal(getCodexServiceTierOptionValue(selection), "flex");
});

it("keeps legacy persisted fast mode selections working", () => {
  const selection = createModelSelection(ProviderInstanceId.make("codex"), "gpt-5.4", [
    { id: "fastMode", value: true },
  ]);

  assert.equal(getCodexServiceTierOptionValue(selection), "fast");
});

it("maps Daybreak on and off without changing the selected model", () => {
  for (const [enabled, expected] of [
    [true, "daybreakBlue"],
    [false, "standard"],
  ] as const) {
    const selection = createModelSelection(ProviderInstanceId.make("codex"), "gpt-5.6-sol", [
      { id: "daybreak", value: enabled },
    ]);
    assert.equal(getCodexCyberAccessProgramOptionValue(selection), expected);
    assert.equal(selection.model, "gpt-5.6-sol");
  }
  assert.equal(getCodexCyberAccessProgramOptionValue(undefined), undefined);
  assert.equal(
    getCodexCyberAccessProgramOptionValue(
      createModelSelection(ProviderInstanceId.make("codex"), "gpt-5.6-sol"),
    ),
    undefined,
  );
});

it("does not send a stale Daybreak preference after switching to Astra", () => {
  assert.equal(
    getCodexCyberAccessProgramOptionValue(
      createModelSelection(ProviderInstanceId.make("codex"), "gpt-6-astra", [
        { id: "daybreak", value: true },
      ]),
    ),
    undefined,
  );
});
