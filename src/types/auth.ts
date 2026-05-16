export const USER_ROLES = [
  "admin",
  "inspector",
  "lgu_admin",
  "office_supervisor",
  "office_clerk",
  "business_owner",
  "citizen",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type AccessScope = "assigned" | "office" | "lgu" | "global" | "own";

export interface RoleProfile {
  label: string;
  permissions: string[];
  scope: AccessScope;
}

export const ROLE_PROFILES: Record<UserRole, RoleProfile> = {
  admin: {
    label: "Platform Admin",
    permissions: [
      "business:create",
      "business:read",
      "business:update",
      "permit:create",
      "permit:read",
      "permit:update",
      "inspection:assign",
      "inspection:create",
      "inspection:read",
      "inspection:update",
      "certificate:create",
      "certificate:read",
      "lgu:manage",
      "office:manage",
      "user:manage",
      "module:manage",
      "report:read",
      "payment:read",
      "cap:create",
      "cap:manage",
    ],
    scope: "global",
  },
  lgu_admin: {
    label: "LGU Administrator",
    permissions: [
      "business:create",
      "business:read",
      "business:update",
      "permit:create",
      "permit:read",
      "permit:update",
      "inspection:assign",
      "inspection:create",
      "inspection:read",
      "inspection:update",
      "certificate:create",
      "certificate:read",
      "office:manage",
      "user:manage",
      "report:read",
      "payment:read",
      "cap:create",
      "cap:manage",
    ],
    scope: "lgu",
  },
  office_supervisor: {
    label: "Office Supervisor",
    permissions: [
      "business:read",
      "permit:read",
      "permit:update",
      "inspection:assign",
      "inspection:create",
      "inspection:read",
      "inspection:update",
      "certificate:create",
      "certificate:read",
      "report:read",
      "payment:read",
      "cap:create",
      "cap:manage",
    ],
    scope: "office",
  },
  office_clerk: {
    label: "Office Clerk",
    permissions: [
      "business:create",
      "business:read",
      "permit:create",
      "permit:read",
      "inspection:create",
      "inspection:read",
      "payment:read",
    ],
    scope: "office",
  },
  inspector: {
    label: "Field Inspector",
    permissions: [
      "business:read",
      "permit:read",
      "inspection:read",
      "inspection:update:assigned",
      "cap:read",
    ],
    scope: "assigned",
  },
  business_owner: {
    label: "Business Owner",
    permissions: [
      "permit:read:own",
      "finding:read:own",
      "certificate:read:own",
      "payment:read:own",
      "reinspection:request",
      "cap:read:own",
      "cap:acknowledge",
    ],
    scope: "own",
  },
  citizen: {
    label: "Citizen",
    permissions: ["issue_report:create", "issue_report:read:own"],
    scope: "own",
  },
};

// Roles with elevated write access (used for authorize() guards on admin routes)
export const ADMIN_ROLES: UserRole[] = [
  "admin",
  "lgu_admin",
  "office_supervisor",
];

export const AUTHENTICATED_ROLES: UserRole[] = [...USER_ROLES];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function normalizeUserRoleInput(value: string): UserRole | null {
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");

  return isUserRole(normalized) ? normalized : null;
}
