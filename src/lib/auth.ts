export type DashboardRoute = "/UsersTab/home" | "/DeliveryTab";

export function getDashboardRoute(role: unknown): DashboardRoute | null {
  if (typeof role !== "string") return null;

  const normalizedRole = role.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalizedRole === "user") return "/UsersTab/home";
  if (
    normalizedRole === "delivery_partner" ||
    normalizedRole === "deliverypartner" ||
    normalizedRole === "delivery"
  ) {
    return "/DeliveryTab";
  }

  return null;
}
