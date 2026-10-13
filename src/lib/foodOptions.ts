import type { FoodCustomizationGroup, FoodOption } from "../types/food";

function getString(
  record: Record<string, unknown>,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function isAvailableChoice(record: Record<string, unknown>): boolean {
  if (record.active === false || record.is_active === false) return false;
  if (record.status === undefined) return true;
  const status = String(record.status).toLowerCase();
  return status === "active" || status === "1" || status === "true" || status === "enabled";
}

function parseChoice(value: unknown, prefix: string): FoodOption | null {
  if (typeof value === "string" && value.trim()) {
    const name = value.trim();
    return { id: `${prefix}-${name}`, name, price: 0 };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  if (!isAvailableChoice(record)) return null;
  const name = getString(
    record,
    ["option_name", "addon_name", "customization_name", "name", "label", "title", "value"],
    "",
  );
  if (!name) return null;

  const priceValue =
    record.additional_price ??
    record.addon_price ??
    record.price_adjustment ??
    record.price ??
    record.final_price ??
    0;
  const parsedPrice = Number(priceValue);

  return {
    id: `${prefix}-${getString(record, ["option_id", "addon_id", "customization_id", "id"], name)}`,
    name,
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
  };
}

export function parseAddonChoices(value: unknown): FoodOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => parseChoice(item, `addon-${index}`))
    .filter((item): item is FoodOption => item !== null);
}

export function parseCustomizationGroups(value: unknown): FoodCustomizationGroup[] {
  if (!Array.isArray(value)) return [];

  const groups: FoodCustomizationGroup[] = [];
  const flatChoices: FoodOption[] = [];
  let flatRequired = false;

  value.forEach((item, groupIndex) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      const choice = parseChoice(item, `custom-${groupIndex}`);
      if (choice) flatChoices.push(choice);
      return;
    }

    const record = item as Record<string, unknown>;
    const nestedOptions =
      record.options ??
      record.values ??
      record.items ??
      record.customization_options;

    if (Array.isArray(nestedOptions)) {
      const options = nestedOptions
        .map((option, optionIndex) => parseChoice(option, `custom-${groupIndex}-${optionIndex}`))
        .filter((option): option is FoodOption => option !== null);

      if (options.length) {
        groups.push({
          id: `custom-group-${groupIndex}`,
          name: getString(
            record,
            ["group_name", "customization_group", "title", "name", "label"],
            "Choose an option",
          ),
          required:
            record.required === true ||
            record.is_required === true ||
            String(record.required ?? record.is_required ?? "").toLowerCase() === "true" ||
            String(record.required ?? record.is_required ?? "") === "1",
          options,
        });
      }
      return;
    }

    const choice = parseChoice(record, `custom-${groupIndex}`);
    if (choice) flatChoices.push(choice);
    flatRequired =
      flatRequired ||
      record.required === true ||
      record.is_required === true ||
      String(record.required ?? record.is_required ?? "").toLowerCase() === "true";
  });

  if (flatChoices.length) {
    groups.push({
      id: "custom-group-flat",
      name: "Customizations",
      required: flatRequired,
      options: flatChoices,
    });
  }
  return groups;
}
