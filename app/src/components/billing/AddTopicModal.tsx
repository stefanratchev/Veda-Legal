"use client";

import { useState, useEffect } from "react";
import type { PricingMode } from "@/types";

interface AddTopicModalProps {
  isLoading: boolean;
  error: string | null;
  defaultHourlyRate: number | null;
  onSubmit: (topicName: string, pricingMode: PricingMode, hourlyRate: number | null, fixedFee: number | null, capHours: number | null, discountType: "PERCENTAGE" | "AMOUNT" | null, discountValue: number | null) => void;
  onClose: () => void;
}

export function AddTopicModal({ isLoading, error, defaultHourlyRate, onSubmit, onClose }: AddTopicModalProps) {
  const [topicName, setTopicName] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("HOURLY");
  const [hourlyRate, setHourlyRate] = useState(defaultHourlyRate?.toString() || "");
  const [fixedFee, setFixedFee] = useState("");
  const [capHours, setCapHours] = useState("");
  const [discountToggle, setDiscountToggle] = useState<"PERCENTAGE" | "AMOUNT" | null>(null);
  const [discountVal, setDiscountVal] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = topicName.trim();
    if (!trimmedName) {
      setValidationError("Topic name is required");
      return;
    }

    const rate = pricingMode === "HOURLY" && hourlyRate ? parseFloat(hourlyRate) : null;
    const fee = pricingMode === "FIXED" && fixedFee ? parseFloat(fixedFee) : null;
    const cap = pricingMode === "HOURLY" && capHours ? parseFloat(capHours) : null;
    const dType = discountToggle;
    const dVal = discountToggle && discountVal ? parseFloat(discountVal) : null;

    onSubmit(trimmedName, pricingMode, rate, fee, cap, dType, dVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-md bg-[var(--bg-elevated)] rounded-lg shadow-xl animate-fade-up"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            Add Topic
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {(error || validationError) && (
            <div className="p-3 text-sm text-[var(--danger)] bg-[var(--danger-bg)] rounded">
              {error || validationError}
            </div>
          )}

          {/* Topic Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Topic Name <span className="text-[var(--danger)]">*</span>
            </label>
            <input
              type="text"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="e.g., Legal consultation"
              className="w-full px-3 py-2 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
              autoFocus
            />
          </div>

          {/* Pricing Mode */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Pricing Mode
            </label>
            <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setPricingMode("HOURLY")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  pricingMode === "HOURLY"
                    ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Hourly
              </button>
              <button
                type="button"
                onClick={() => setPricingMode("FIXED")}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  pricingMode === "FIXED"
                    ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Fixed
              </button>
            </div>
          </div>

          {/* Hourly Rate or Fixed Fee */}
          {pricingMode === "HOURLY" ? (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Hourly Rate
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder={defaultHourlyRate ? String(defaultHourlyRate) : "0"}
                  className="w-full px-3 py-2 pr-16 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                  step="0.01"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">EUR/h</span>
              </div>
              {defaultHourlyRate && !hourlyRate && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Client default rate: {defaultHourlyRate} EUR/h
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Fixed Fee
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={fixedFee}
                  onChange={(e) => setFixedFee(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 pr-12 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                  step="0.01"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">EUR</span>
              </div>
            </div>
          )}

          {/* Hour Cap (HOURLY mode only) */}
          {pricingMode === "HOURLY" && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Hour Cap <span className="text-xs text-[var(--text-muted)]">(optional)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={capHours}
                  onChange={(e) => setCapHours(e.target.value)}
                  placeholder="No cap"
                  className="w-full px-3 py-2 pr-12 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                  step="0.25"
                  min="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">hrs</span>
              </div>
            </div>
          )}

          {/* Discount (optional) */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Discount <span className="text-xs text-[var(--text-muted)]">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setDiscountToggle(discountToggle === "PERCENTAGE" ? null : "PERCENTAGE")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    discountToggle === "PERCENTAGE"
                      ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountToggle(discountToggle === "AMOUNT" ? null : "AMOUNT")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    discountToggle === "AMOUNT"
                      ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  EUR
                </button>
              </div>
              {discountToggle && (
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={discountVal}
                    onChange={(e) => setDiscountVal(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 pr-12 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                    step="0.01"
                    min="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
                    {discountToggle === "PERCENTAGE" ? "%" : "EUR"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium bg-[var(--accent-pink)] text-[var(--bg-deep)] rounded hover:bg-[var(--accent-pink-dim)] transition-colors disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Topic"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
