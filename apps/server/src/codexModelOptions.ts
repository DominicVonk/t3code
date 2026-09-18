import type { ModelSelection } from "@t3tools/contracts";
import {
  getModelSelectionBooleanOptionValue,
  getModelSelectionStringOptionValue,
} from "@t3tools/shared/model";

export function getCodexServiceTierOptionValue(
  modelSelection: ModelSelection | null | undefined,
): string | undefined {
  return (
    getModelSelectionStringOptionValue(modelSelection, "serviceTier") ??
    (getModelSelectionBooleanOptionValue(modelSelection, "fastMode") === true ? "fast" : undefined)
  );
}

/** Explicit false must override Codex's automatic treatment after Daybreak is unchecked. */
export function getCodexCyberAccessProgramOptionValue(
  modelSelection: ModelSelection | null | undefined,
): "standard" | "daybreakBlue" | undefined {
  if (modelSelection?.model !== "gpt-5.6-sol") return undefined;
  const enabled = getModelSelectionBooleanOptionValue(modelSelection, "daybreak");
  return enabled === undefined ? undefined : enabled ? "daybreakBlue" : "standard";
}
