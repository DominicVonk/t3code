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

it("maps Daybreak on and off on current and older models without changing their IDs", () => {
  for (const model of [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-5.5",
    "gpt-5.4",
    "gpt-5.3-codex",
    "gpt-5.1",
    "openai.gpt-5.5",
  ]) {
    for (const [enabled, expected] of [
      [true, "daybreakBlue"],
      [false, "standard"],
    ] as const) {
      const selection = createModelSelection(ProviderInstanceId.make("codex"), model, [
        { id: "daybreak", value: enabled },
      ]);
      assert.equal(getCodexCyberAccessProgramOptionValue(selection), expected);
      assert.equal(selection.model, model);
    }
    assert.equal(
      getCodexCyberAccessProgramOptionValue(
        createModelSelection(ProviderInstanceId.make("codex"), model),
      ),
      undefined,
    );
  }
  assert.equal(getCodexCyberAccessProgramOptionValue(undefined), undefined);
});

it("ignores stale Daybreak preferences for both Astra variants and dedicated Daybreak aliases", () => {
  for (const model of [
    "gpt-6-astra",
    "gpt-6-astra-wm",
    "openai.gpt-6-astra",
    "openai.gpt-6-astra-wm",
    "gpt-daybreak-blue-latest",
    "gpt-daybreak-red-latest",
  ]) {
    for (const enabled of [true, false]) {
      assert.equal(
        getCodexCyberAccessProgramOptionValue(
          createModelSelection(ProviderInstanceId.make("codex"), model, [
            { id: "daybreak", value: enabled },
          ]),
        ),
        undefined,
      );
    }
  }
});
