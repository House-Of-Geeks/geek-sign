"use client";

import { createContext, useContext, type ReactNode } from "react";

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
  /** Request the signer modal for this field — the parent decides which UI to show */
  onRequestField: (fieldKey: string) => void;
  /** Direct value change (used for checkbox toggles) */
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
