import type { ModelSelection } from "@t3tools/contracts";
import {
  codexModelFamily,
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

/** Codex's app excludes these Astra IDs; the TUI's Sol-only refusal copy is not a support list. */
export function supportsCodexDaybreakBlueModel(model: string): boolean {
  const family = codexModelFamily(model);
  return (
    family !== "gpt-6-astra" &&
    family !== "gpt-6-astra-wm" &&
    // Dedicated Daybreak aliases retain their own access-program routing.
    family !== "gpt-daybreak-blue-latest" &&
    family !== "gpt-daybreak-red-latest"
  );
}

/** Explicit false must override Codex's automatic treatment after Daybreak is unchecked. */
export function getCodexCyberAccessProgramOptionValue(
  modelSelection: ModelSelection | null | undefined,
): "standard" | "daybreakBlue" | undefined {
  if (!modelSelection || !supportsCodexDaybreakBlueModel(modelSelection.model)) return undefined;
  const enabled = getModelSelectionBooleanOptionValue(modelSelection, "daybreak");
  return enabled === undefined ? undefined : enabled ? "daybreakBlue" : "standard";
}
