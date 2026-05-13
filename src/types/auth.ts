export const USER_ROLES = ["admin", "inspector"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type AccessScope = "assigned" | "global";

export interface RoleProfile {
  label: string;
  permissions: string[];
  scope: AccessScope;
}

export const ROLE_PROFILES: Record<UserRole, RoleProfile> = {
  admin: {
    label: "BPLO Admin",
    permissions: [
      "business:create",
      "business:read",
      "business:update",
      "permit:create",
      "permit:read",
      "permit:update",
      "inspection:assign",
      "inspection:read",
    ],
    scope: "global",
  },
  inspector: {
    label: "Field Inspector",
    permissions: [
      "business:read",
      "permit:read",
      "inspection:read",
      "inspection:update:assigned",
    ],
    scope: "assigned",
  },
};

export const ADMIN_ROLES: UserRole[] = ["admin"];
export const AUTHENTICATED_ROLES: UserRole[] = [...USER_ROLES];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function normalizeUserRoleInput(value: string): UserRole | null {
  const normalized = value.trim().toLowerCase();

  return isUserRole(normalized) ? normalized : null;
}
