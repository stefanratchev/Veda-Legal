"use client";

import { useState, useCallback } from "react";
import type { ServiceDescriptionTopic, PricingMode } from "@/types";
import { LineItemRow } from "./LineItemRow";
import { AddLineItemModal } from "./AddLineItemModal";
import { calculateTopicTotal, calculateTopicBaseTotal, formatCurrency } from "@/lib/billing-pdf";

interface TopicSectionProps {
  topic: ServiceDescriptionTopic;
  serviceDescriptionId: string;
  isEditable: boolean;
  clientHourlyRate: number | null;
  onUpdateTopic: (topicId: string, updates: Partial<ServiceDescriptionTopic>) => Promise<void>;
  onDeleteTopic: (topicId: string) => Promise<void>;
  onAddLineItem: (topicId: string, data: { date?: string; description: string; hours?: number; fixedAmount?: number }) => Promise<void>;
  onUpdateLineItem: (topicId: string, itemId: string, updates: { description?: string; hours?: number }) => Promise<void>;
  onDeleteLineItem: (topicId: string, itemId: string) => Promise<void>;
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TopicSection({
  topic,
  serviceDescriptionId,
  isEditable,
  clientHourlyRate,
  onUpdateTopic,
  onDeleteTopic,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
}: TopicSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Calculate totals
  const rawHours = topic.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0);
  const billedHours = topic.capHours && topic.pricingMode === "HOURLY" ? Math.min(rawHours, topic.capHours) : rawHours;
  const baseTotal = calculateTopicBaseTotal(topic);
  const topicTotal = calculateTopicTotal(topic);
  const hasDiscount = topic.discountType && topic.discountValue;

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handlePricingModeChange = useCallback(
    async (mode: PricingMode) => {
      if (!isEditable || mode === topic.pricingMode) return;
      setIsUpdating(true);
      try {
        await onUpdateTopic(topic.id, { pricingMode: mode });
      } catch {
        // Error handled by parent
      } finally {
        setIsUpdating(false);
      }
    },
    [isEditable, topic.id, topic.pricingMode, onUpdateTopic]
  );

  const handleHourlyRateChange = useCallback(
    async (value: string) => {
      if (!isEditable) return;
      const rate = parseFloat(value) || null;
      setIsUpdating(true);
      try {
        await onUpdateTopic(topic.id, { hourlyRate: rate });
      } catch {
        // Error handled by parent
      } finally {
        setIsUpdating(false);
      }
    },
    [isEditable, topic.id, onUpdateTopic]
  );

  const handleFixedFeeChange = useCallback(
    async (value: string) => {
      if (!isEditable) return;
      const fee = parseFloat(value) || null;
      setIsUpdating(true);
      try {
        await onUpdateTopic(topic.id, { fixedFee: fee });
      } catch {
        // Error handled by parent
      } finally {
        setIsUpdating(false);
      }
    },
    [isEditable, topic.id, onUpdateTopic]
  );

  const handleCapHoursChange = useCallback(
    async (value: string) => {
      if (!isEditable) return;
      const cap = parseFloat(value) || null;
      setIsUpdating(true);
      try {
        await onUpdateTopic(topic.id, { capHours: cap });
      } catch {
        // Error handled by parent
      } finally {
        setIsUpdating(false);
      }
    },
    [isEditable, topic.id, onUpdateTopic]
  );

  const handleDiscountTypeChange = useCallback(
    async (type: "PERCENTAGE" | "AMOUNT" | null) => {
      if (!isEditable) return;
      setIsUpdating(true);
      try {
        if (!type) {
          await onUpdateTopic(topic.id, { discountType: null, discountValue: null });
        } else {
          await onUpdateTopic(topic.id, {
            discountType: type,
            discountValue: topic.discountValue || 0,
          });
        }
      } catch {
        // Error handled by parent
      } finally {
        setIsUpdating(false);
      }
    },
    [isEditable, topic.id, topic.discountValue, onUpdateTopic]
  );

  const handleDiscountValueChange = useCallback(
    async (value: string) => {
      if (!isEditable) return;
      const val = parseFloat(value) || null;
      setIsUpdating(true);
      try {
        await onUpdateTopic(topic.id, { discountValue: val });
      } catch {
        // Error handled by parent
      } finally {
        setIsUpdating(false);
      }
    },
    [isEditable, topic.id, onUpdateTopic]
  );

  const handleDelete = useCallback(() => {
    onDeleteTopic(topic.id);
  }, [topic.id, onDeleteTopic]);

  const handleOpenAddItem = useCallback(() => {
    setAddItemError(null);
    setShowAddItemModal(true);
  }, []);

  const handleCloseAddItem = useCallback(() => {
    setShowAddItemModal(false);
    setAddItemError(null);
  }, []);

  const handleAddItem = useCallback(
    async (data: { date?: string; description: string; hours?: number; fixedAmount?: number }) => {
      setIsAddingItem(true);
      setAddItemError(null);
      try {
        await onAddLineItem(topic.id, data);
        setShowAddItemModal(false);
      } catch (error) {
        setAddItemError(error instanceof Error ? error.message : "Failed to add line item");
      } finally {
        setIsAddingItem(false);
      }
    },
    [topic.id, onAddLineItem]
  );

  const handleUpdateItem = useCallback(
    async (itemId: string, updates: { description?: string; hours?: number }) => {
      await onUpdateLineItem(topic.id, itemId, updates);
    },
    [topic.id, onUpdateLineItem]
  );

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      onDeleteLineItem(topic.id, itemId);
    },
    [topic.id, onDeleteLineItem]
  );

  return (
    <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-surface)] transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="font-heading text-base font-semibold text-[var(--text-primary)]">
            {topic.topicName}
          </h3>
          <span className="text-xs text-[var(--text-muted)]">
            {topic.lineItems.length} item{topic.lineItems.length !== 1 ? "s" : ""}
            {topic.pricingMode === "HOURLY" && rawHours > 0 && (
              <>
                {` \u2022 ${formatHours(billedHours)}`}
                {topic.capHours && rawHours > topic.capHours && (
                  <span className="text-[var(--warning)]"> (capped from {formatHours(rawHours)})</span>
                )}
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {hasDiscount ? (
            <div className="text-right">
              <div className="text-xs text-[var(--text-muted)] line-through">
                {formatCurrency(baseTotal)}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Discount ({topic.discountType === "PERCENTAGE" ? `${topic.discountValue}%` : formatCurrency(topic.discountValue!)}): -{formatCurrency(
                  topic.discountType === "PERCENTAGE" ? baseTotal * topic.discountValue! / 100 : topic.discountValue!
                )}
              </div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {formatCurrency(topicTotal)}
              </div>
            </div>
          ) : (
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {formatCurrency(topicTotal)}
            </span>
          )}
          {isEditable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
              title="Delete topic"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)]">
          {/* Pricing controls */}
          <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-deep)]">
            <div className="flex items-center gap-6">
              {/* Pricing mode toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Pricing:</span>
                <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePricingModeChange("HOURLY");
                    }}
                    disabled={!isEditable || isUpdating}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      topic.pricingMode === "HOURLY"
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    Hourly
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePricingModeChange("FIXED");
                    }}
                    disabled={!isEditable || isUpdating}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      topic.pricingMode === "FIXED"
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    Fixed
                  </button>
                </div>
              </div>

              {/* Rate/Fee input */}
              {topic.pricingMode === "HOURLY" ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-muted)]">Rate:</label>
                  <input
                    type="number"
                    value={topic.hourlyRate ?? ""}
                    onChange={(e) => handleHourlyRateChange(e.target.value)}
                    onBlur={(e) => handleHourlyRateChange(e.target.value)}
                    disabled={!isEditable}
                    placeholder={clientHourlyRate ? String(clientHourlyRate) : "0"}
                    className="w-24 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
                    step="0.01"
                    min="0"
                  />
                  <span className="text-xs text-[var(--text-muted)]">EUR/h</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-muted)]">Fixed Fee:</label>
                  <input
                    type="number"
                    value={topic.fixedFee ?? ""}
                    onChange={(e) => handleFixedFeeChange(e.target.value)}
                    onBlur={(e) => handleFixedFeeChange(e.target.value)}
                    disabled={!isEditable}
                    placeholder="0"
                    className="w-24 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
                    step="0.01"
                    min="0"
                  />
                  <span className="text-xs text-[var(--text-muted)]">EUR</span>
                </div>
              )}

              {/* Cap hours (HOURLY mode only) */}
              {topic.pricingMode === "HOURLY" && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[var(--text-muted)]">Cap:</label>
                  <input
                    type="number"
                    value={topic.capHours ?? ""}
                    onChange={(e) => handleCapHoursChange(e.target.value)}
                    disabled={!isEditable}
                    placeholder="No cap"
                    className="w-20 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
                    step="0.25"
                    min="0"
                  />
                  <span className="text-xs text-[var(--text-muted)]">hrs</span>
                </div>
              )}

              {/* Discount toggle + value */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Discount:</span>
                <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDiscountTypeChange(topic.discountType === "PERCENTAGE" ? null : "PERCENTAGE");
                    }}
                    disabled={!isEditable || isUpdating}
                    className={`px-2 py-1 text-xs font-medium transition-colors ${
                      topic.discountType === "PERCENTAGE"
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    %
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDiscountTypeChange(topic.discountType === "AMOUNT" ? null : "AMOUNT");
                    }}
                    disabled={!isEditable || isUpdating}
                    className={`px-2 py-1 text-xs font-medium transition-colors ${
                      topic.discountType === "AMOUNT"
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    EUR
                  </button>
                </div>
                {topic.discountType && (
                  <input
                    type="number"
                    value={topic.discountValue ?? ""}
                    onChange={(e) => handleDiscountValueChange(e.target.value)}
                    disabled={!isEditable}
                    placeholder="0"
                    className="w-20 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
                    step="0.01"
                    min="0"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  <th className="px-4 py-2 text-left font-medium w-28">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium w-24">Time</th>
                  {isEditable && <th className="px-4 py-2 text-right font-medium w-16">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {topic.lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={isEditable ? 4 : 3} className="px-4 py-6 text-center text-sm text-[var(--text-muted)] italic">
                      No line items yet
                    </td>
                  </tr>
                ) : (
                  topic.lineItems.map((item) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      isEditable={isEditable}
                      onUpdate={handleUpdateItem}
                      onDelete={handleDeleteItem}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Add line item button */}
          {isEditable && (
            <div className="p-3 border-t border-[var(--border-subtle)]">
              <button
                onClick={handleOpenAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Line Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Line Item Modal */}
      {showAddItemModal && (
        <AddLineItemModal
          isLoading={isAddingItem}
          error={addItemError}
          onSubmit={handleAddItem}
          onClose={handleCloseAddItem}
        />
      )}
    </div>
  );
}
