import type { Plan } from "@/types";

export interface PlanConfig {
  id: Plan;
  name: string;
  description: string;
  price: number;
  priceId?: string; // Stripe price ID
  features: string[];
  notIncluded?: string[];
  popular?: boolean;
  limits: {
    templates: number;
    retentionDays: number;
    teamMembers: number;
    smsEnabled: boolean;
    customBranding: boolean;
    resizeFields: boolean;
    notifyOnOpen: boolean;
    customMessages: boolean;
  };
}

const plansConfig: Record<Plan, PlanConfig> = {
  free: {
    id: "free",
    name: "Free Forever",
    description: "No credit card required. No hidden fees. No limits.",
    price: 0,
    features: [
      "Unlimited document uploads",
      "Unlimited recipients",
      "1 template",
      "Email notifications for signers",
      "Complete document finalization and distribution",
      "Detailed audit logs and record keeping",
      "Legally compliant electronic signatures",
      "14-day document retention",
    ],
    notIncluded: [
      "Custom branding",
      "Team collaboration",
    ],
    limits: {
      templates: 1,
      retentionDays: 14,
      teamMembers: 0,
      smsEnabled: false,
      customBranding: false,
      resizeFields: false,
      notifyOnOpen: false,
      customMessages: false,
    },
  },
  starter: {
    id: "starter",
    name: "Starter Plan",
    popular: true,
    description: "Everything in Free plus:",
    price: 9.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: [
      "Unlimited templates",
      "Email notifications on document open",
      "Custom recipient messages",
      "Unlimited document retention",
      "Resize signature fields",
      "Custom branding",
    ],
    limits: {
      templates: -1, // unlimited
      retentionDays: -1, // unlimited
      teamMembers: 0,
      smsEnabled: true,
      customBranding: true,
      resizeFields: true,
      notifyOnOpen: true,
      customMessages: true,
    },
  },
  team: {
    id: "team",
    name: "Team Plan",
    description: "Starter features plus collaborative tools for small teams.",
    price: 39.99,
    priceId: process.env.STRIPE_TEAM_PRICE_ID,
    features: [
      "Everything in Starter",
      "Unlimited team members",
      "Invite teammates to manage documents together",
      "Shared team visibility across sent documents",
      "Centralized billing for your entire team",
    ],
    limits: {
      templates: -1,
      retentionDays: -1,
      teamMembers: -1, // unlimited
      smsEnabled: true,
      customBranding: true,
      resizeFields: true,
      notifyOnOpen: true,
      customMessages: true,
    },
  },
};

export function canUseFeature(
  plan: Plan,
  feature: keyof PlanConfig["limits"]
): boolean {
  const planConfig = plansConfig[plan];
  const limit = planConfig.limits[feature];

  if (typeof limit === "boolean") {
    return limit;
  }

  return limit !== 0;
}

export function getLimit(
  plan: Plan,
  feature: keyof PlanConfig["limits"]
): number | boolean {
  return plansConfig[plan].limits[feature];
}

// Export as array for pricing page
export const plans: PlanConfig[] = Object.values(plansConfig);

// Export config for accessing by plan ID
export { plansConfig };
