export type FoodOption = {
  id: string;
  name: string;
  price: number;
};

export type FoodCustomizationGroup = {
  id: string;
  name: string;
  required: boolean;
  options: FoodOption[];
};

export type FoodProduct = {
  id?: string | number;
  food_id?: string | number;
  food_name?: string;
  name?: string;
  description?: string;
  category_name?: string;
  cuisine_name?: string;
  food_type?: string;
  status?: string;
  is_available?: boolean;
  is_spicy?: boolean;
  featured?: boolean;
  mrp?: number | string;
  final_price?: number | string;
  price?: number | string;
  discount?: number | string;
  preparation_time?: number | string;
  portion_size?: string;
  rating?: number | string;
  food_images?: unknown;
  addons?: unknown;
  customizations?: unknown;
  [key: string]: unknown;
};

export type CartItem = {
  key: string;
  food: FoodProduct;
  quantity: number;
  unitPrice: number;
  selectedAddons: FoodOption[];
  selectedCustomizations: FoodOption[];
};

export type CustomizedFoodCartInput = {
  food: FoodProduct;
  quantity: number;
  unitPrice: number;
  selectedAddons: FoodOption[];
  selectedCustomizations: FoodOption[];
};
