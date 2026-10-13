import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Minus, Plus, X } from "lucide-react-native";
import { getFoodName, getFoodPrice } from "../../lib/foods";
import type {
  FoodCustomizationGroup,
  FoodOption,
  FoodProduct,
} from "../../types/food";

type FoodCustomizationModalProps = {
  food: FoodProduct | null;
  onClose: () => void;
  onAdd: (input: {
    food: FoodProduct;
    quantity: number;
    unitPrice: number;
    selectedAddons: FoodOption[];
    selectedCustomizations: FoodOption[];
  }) => Promise<void>;
};

function getString(record: Record<string, unknown>, keys: string[], fallback: string): string {
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

function parseAddonChoices(value: unknown): FoodOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => parseChoice(item, `addon-${index}`))
    .filter((item): item is FoodOption => item !== null);
}

function parseCustomizationGroups(value: unknown): FoodCustomizationGroup[] {
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

export default function FoodCustomizationModal({
  food,
  onClose,
  onAdd,
}: FoodCustomizationModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<FoodOption[]>([]);
  const [selectedCustomizations, setSelectedCustomizations] = useState<FoodOption[]>([]);
  const [addonRequest, setAddonRequest] = useState("");
  const [customizationRequest, setCustomizationRequest] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const addons = useMemo(() => parseAddonChoices(food?.addons), [food]);
  const customizationGroups = useMemo(
    () => parseCustomizationGroups(food?.customizations),
    [food],
  );
  const unitPrice =
    getFoodPrice(food ?? {}) +
    selectedAddons.reduce((total, option) => total + option.price, 0) +
    selectedCustomizations.reduce((total, option) => total + option.price, 0);

  useEffect(() => {
    setQuantity(1);
    setSelectedAddons([]);
    setSelectedCustomizations(
      customizationGroups
        .filter((group) => group.required)
        .flatMap((group) => {
          const option = group.options[0];
          return option ? [{ ...option, groupName: group.name }] : [];
        }),
    );
    setAddonRequest("");
    setCustomizationRequest("");
    setError("");
  }, [food, customizationGroups]);

  const toggleAddon = (option: FoodOption) => {
    setSelectedAddons((current) =>
      current.some((selected) => selected.id === option.id)
        ? current.filter((selected) => selected.id !== option.id)
        : [...current, option],
    );
  };

  const selectCustomization = (group: FoodCustomizationGroup, option: FoodOption) => {
    setSelectedCustomizations((current) => [
      ...current.filter(
        (selected) => !group.options.some((groupOption) => groupOption.id === selected.id),
      ),
      { ...option, groupName: group.name },
    ]);
  };

  const handleAdd = async () => {
    if (!food) return;
    setSaving(true);
    setError("");
    try {
      await onAdd({
        food,
        quantity,
        unitPrice,
        selectedAddons: [
          ...selectedAddons,
          ...addonRequest
            .split("\n")
            .map((name, index) => ({
              id: `requested-addon-${index}`,
              name: name.trim(),
              price: 0,
            }))
            .filter((option) => option.name),
        ],
        selectedCustomizations: [
          ...selectedCustomizations,
          ...(customizationRequest.trim()
            ? [{
                id: "requested-customization",
                name: customizationRequest.trim(),
                price: 0,
                groupName: "Additional customization",
              }]
            : []),
        ],
      });
      onClose();
    } catch (addError) {
      console.error("Failed to add customized food to cart:", addError);
      setError("We could not save this item to your cart. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={food !== null}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/45"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="max-h-[90%] rounded-t-[28px] bg-white pb-8">
          <View className="flex-row items-center justify-between border-b border-slate-100 px-5 py-4">
            <View className="flex-1 pr-4">
              <Text className="text-lg font-extrabold text-[#17251E]" numberOfLines={1}>
                {food ? getFoodName(food) : ""}
              </Text>
              <Text className="mt-1 text-sm font-bold text-[#1A6A3B]">
                ₹{unitPrice.toFixed(2)} each
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close customization"
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-100"
              onPress={onClose}
            >
              <X color="#334155" size={20} />
            </Pressable>
          </View>

          <ScrollView
            className="shrink"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {addons.length > 0 && (
              <View className="mb-5">
                <Text className="mb-2 text-base font-extrabold text-[#17251E]">Add-ons</Text>
                {addons.map((option) => {
                  const selected = selectedAddons.some((item) => item.id === option.id);
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      className="mb-2 min-h-12 flex-row items-center justify-between rounded-xl border border-slate-200 px-3"
                      onPress={() => toggleAddon(option)}
                    >
                      <Text className="flex-1 text-sm font-semibold text-slate-700">
                        {option.name}
                      </Text>
                      <Text className="ml-3 text-sm font-bold text-[#1A6A3B]">
                        {option.price > 0 ? `+₹${option.price.toFixed(2)}` : "Included"}
                      </Text>
                      <View className={`ml-3 h-5 w-5 rounded border ${selected ? "border-[#1A6A3B] bg-[#1A6A3B]" : "border-slate-300"}`} />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {customizationGroups.map((group) => (
              <View key={group.id} className="mb-5">
                <Text className="mb-2 text-base font-extrabold text-[#17251E]">
                  {group.name}
                  {group.required && <Text className="text-rose-600"> *</Text>}
                </Text>
                {group.options.map((option) => {
                  const selected = selectedCustomizations.some(
                    (item) => item.id === option.id,
                  );
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      className="mb-2 min-h-12 flex-row items-center justify-between rounded-xl border border-slate-200 px-3"
                      onPress={() => selectCustomization(group, option)}
                    >
                      <Text className="flex-1 text-sm font-semibold text-slate-700">
                        {option.name}
                      </Text>
                      <Text className="ml-3 text-sm font-bold text-[#1A6A3B]">
                        {option.price > 0 ? `+₹${option.price.toFixed(2)}` : "Included"}
                      </Text>
                      <View className={`ml-3 h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-[#1A6A3B]" : "border-slate-300"}`}>
                        {selected && <View className="h-2.5 w-2.5 rounded-full bg-[#1A6A3B]" />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <View className="mb-5">
              <Text className="mb-2 text-sm font-bold text-slate-700">
                Additional add-ons (optional)
              </Text>
              <TextInput
                accessibilityLabel="Additional add-ons"
                className="min-h-24 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"
                multiline
                onChangeText={setAddonRequest}
                placeholder="Enter extra add-ons, one per line (e.g. Extra sauce)"
                placeholderTextColor="#94A3B8"
                textAlignVertical="top"
                value={addonRequest}
              />
              <Text className="mt-2 text-right text-xs text-slate-400">
                Typed requests do not change the price.
              </Text>
            </View>

            <View className="mb-2">
              <Text className="mb-2 text-sm font-bold text-slate-700">
                Additional customization (optional)
              </Text>
              <TextInput
                accessibilityLabel="Additional customization"
                className="min-h-24 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700"
                multiline
                onChangeText={setCustomizationRequest}
                placeholder="e.g. Less oil, extra spicy, no onions"
                placeholderTextColor="#94A3B8"
                textAlignVertical="top"
                value={customizationRequest}
              />
            </View>

            {error ? (
              <Text accessibilityRole="alert" className="mb-3 text-sm font-semibold text-rose-700">
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <View className="flex-row items-center gap-3 border-t border-slate-100 px-5 pt-4">
            <View className="h-12 flex-row items-center rounded-xl border border-slate-200">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                className="h-12 w-11 items-center justify-center"
                onPress={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                <Minus color="#334155" size={17} />
              </Pressable>
              <Text className="min-w-7 text-center text-base font-bold text-slate-800">
                {quantity}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                className="h-12 w-11 items-center justify-center"
                onPress={() => setQuantity((current) => current + 1)}
              >
                <Plus color="#334155" size={17} />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              className={`h-12 flex-1 items-center justify-center rounded-xl ${saving ? "bg-slate-400" : "bg-[#1A6A3B]"}`}
              disabled={saving}
              onPress={() => void handleAdd()}
            >
              <Text className="text-sm font-extrabold text-white">
                {saving ? "Adding..." : `Add · ₹${(unitPrice * quantity).toFixed(2)}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
