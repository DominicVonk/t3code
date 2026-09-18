import { describe, expect, it } from "vite-plus/test";

import type { ModelCapabilities } from "@t3tools/contracts";

import { applyProviderOptionSelection, resolveProviderOptionDescriptors } from "./providerOptions";

const CODEX_CAPABILITIES: ModelCapabilities = {
  optionDescriptors: [
    {
      id: "reasoningEffort",
      label: "Reasoning",
      type: "select",
      options: [
        { id: "medium", label: "Medium", isDefault: true },
        { id: "high", label: "High" },
      ],
      currentValue: "medium",
    },
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      options: [
        { id: "default", label: "Standard", isDefault: true },
        { id: "priority", label: "Fast" },
      ],
      currentValue: "default",
    },
  ],
};

describe("mobile provider options", () => {
  const daybreak = {
    id: "daybreak",
    label: "Daybreak",
    type: "boolean",
    currentValue: false,
  } as const;

  it("round-trips Daybreak on and off when it is the model's only option", () => {
    const capabilities = { optionDescriptors: [daybreak] };
    const initial = resolveProviderOptionDescriptors({ capabilities, selections: undefined });
    expect(initial).toEqual([daybreak]);

    const enabled = applyProviderOptionSelection(initial, { id: "daybreak", value: true });
    expect(enabled).toEqual([{ id: "daybreak", value: true }]);
    const restored = resolveProviderOptionDescriptors({ capabilities, selections: enabled });
    expect(restored).toEqual([{ ...daybreak, currentValue: true }]);

    const disabled = applyProviderOptionSelection(restored, { id: "daybreak", value: false });
    expect(disabled).toEqual([{ id: "daybreak", value: false }]);
    expect(resolveProviderOptionDescriptors({ capabilities, selections: disabled })).toEqual(
      initial,
    );
  });

  it("preserves reasoning and Fast mode when changing Daybreak", () => {
    const descriptors = resolveProviderOptionDescriptors({
      capabilities: {
        optionDescriptors: [...(CODEX_CAPABILITIES.optionDescriptors ?? []), daybreak],
      },
      selections: [
        { id: "reasoningEffort", value: "high" },
        { id: "serviceTier", value: "priority" },
      ],
    });

    expect(applyProviderOptionSelection(descriptors, { id: "daybreak", value: true })).toEqual([
      { id: "reasoningEffort", value: "high" },
      { id: "serviceTier", value: "priority" },
      { id: "daybreak", value: true },
    ]);
  });

  it("does not expose or enable saved Daybreak when the server no longer advertises it", () => {
    const descriptors = resolveProviderOptionDescriptors({
      capabilities: CODEX_CAPABILITIES,
      selections: [{ id: "daybreak", value: true }],
    });

    expect(descriptors.some((descriptor) => descriptor.id === "daybreak")).toBe(false);
    expect(applyProviderOptionSelection(descriptors, { id: "daybreak", value: true })).toBeNull();
  });

  it("updates generic select options without knowing provider-specific ids", () => {
    const descriptors = resolveProviderOptionDescriptors({
      capabilities: CODEX_CAPABILITIES,
      selections: undefined,
    });

    expect(
      applyProviderOptionSelection(descriptors, { id: "serviceTier", value: "priority" }),
    ).toEqual([
      { id: "reasoningEffort", value: "medium" },
      { id: "serviceTier", value: "priority" },
    ]);
    // Choices the model doesn't advertise are rejected, not stored.
    expect(
      applyProviderOptionSelection(descriptors, { id: "serviceTier", value: "turbo" }),
    ).toBeNull();
    expect(applyProviderOptionSelection(descriptors, { id: "unknown", value: "high" })).toBeNull();
  });

  it("updates generic boolean options", () => {
    const descriptors = resolveProviderOptionDescriptors({
      capabilities: {
        optionDescriptors: [{ id: "fastMode", label: "Fast Mode", type: "boolean" }],
      },
      selections: undefined,
    });

    expect(applyProviderOptionSelection(descriptors, { id: "fastMode", value: true })).toEqual([
      { id: "fastMode", value: true },
    ]);
  });
});
