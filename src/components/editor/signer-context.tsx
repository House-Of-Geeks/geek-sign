"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SigningFieldType } from "./types";

export interface SignerFieldState {
  id: string;
  fieldKey: string;
  type: string;
  recipientId: string;
  value: string | null;
  required: boolean;
}

export interface SignerContextValue {
  currentRecipientId: string;
  fieldsByKey: Record<string, SignerFieldState>;
  rolesById: Record<string, { label: string; color: string }>;
  onRequestSignature: (fieldKey: string, kind: "signature" | "initials") => void;
  onRequestDate: (fieldKey: string) => void;
  onChangeValue: (fieldKey: string, value: string | null) => void;
  hasConsented: boolean;
  onConsentRequired: () => void;
}

const SignerContext = createContext<SignerContextValue | null>(null);

export function SignerProvider({
  value,
  children,
}: {
  value: SignerContextValue;
  children: ReactNode;
}) {
  return <SignerContext.Provider value={value}>{children}</SignerContext.Provider>;
}

export function useSigner(): SignerContextValue {
  const ctx = useContext(SignerContext);
  if (!ctx) {
    throw new Error("useSigner must be used inside <SignerProvider>");
  }
  return ctx;
}

export function isOwnField(state: SignerFieldState | undefined, currentRecipientId: string) {
  return !!state && state.recipientId === currentRecipientId;
}

// Map richtext fieldType -> server field.type so the inline node can read the right shape
export function normaliseFieldType(t: string): SigningFieldType {
  if (t === "signature" || t === "initials" || t === "date" || t === "text" || t === "checkbox") {
    return t;
  }
  return "text";
}
