export type DashboardRoute = "/UsersTab/home" | "/DeliveryTab";
export type AuthRole = "user" | "delivery_partner";

export function normalizeAuthRole(role: unknown): AuthRole | null {
  if (typeof role !== "string") return null;

  const normalizedRole = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedRole === "user") return "user";
  if (
    normalizedRole === "delivery_partner" ||
    normalizedRole === "deliverypartner" ||
    normalizedRole === "delivery"
  ) {
    return "delivery_partner";
  }

  return null;
}

export function getDashboardRoute(role: unknown): DashboardRoute | null {
  const normalizedRole = normalizeAuthRole(role);
  if (normalizedRole === "user") return "/UsersTab/home";
  if (normalizedRole === "delivery_partner") return "/DeliveryTab";
  return null;
}
