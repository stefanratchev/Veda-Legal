"use client";

import { useState, useCallback, useEffect, memo } from "react";
import type { ServiceDescriptionTopic, PricingMode } from "@/types";
import { LineItemRow } from "./LineItemRow";
import { AddLineItemModal } from "./AddLineItemModal";
import { calculateTopicTotal, calculateTopicBaseTotal, formatCurrency } from "@/lib/billing-pdf";
import { formatHours } from "@/lib/date-utils";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface TopicSectionProps {
  topic: ServiceDescriptionTopic;
  sortableId?: string;
  serviceDescriptionId: string;
  isEditable: boolean;
  clientHourlyRate: number | null;
  onUpdateTopic: (topicId: string, updates: Partial<ServiceDescriptionTopic>) => Promise<void>;
  onDeleteTopic: (topicId: string) => void;
  onAddLineItem: (topicId: string, data: { date?: string; description: string; hours?: number; fixedAmount?: number }) => Promise<void>;
  onUpdateLineItem: (topicId: string, itemId: string, updates: { description?: string; hours?: number }) => Promise<void>;
  onDeleteLineItem: (topicId: string, itemId: string) => Promise<void>;
  onWaive: (itemId: string, waiveMode: "EXCLUDED" | "ZERO" | null) => Promise<void>;
}

export const TopicSection = memo(function TopicSection({
  topic,
  sortableId,
  serviceDescriptionId,
  isEditable,
  clientHourlyRate,
  onUpdateTopic,
  onDeleteTopic,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  onWaive,
}: TopicSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [addItemError, setAddItemError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Local state for numeric inputs (only fire API on blur)
  const [localRate, setLocalRate] = useState<string>(topic.hourlyRate != null ? String(topic.hourlyRate) : "");
  const [localFee, setLocalFee] = useState<string>(topic.fixedFee != null ? String(topic.fixedFee) : "");
  const [localCap, setLocalCap] = useState<string>(topic.capHours != null ? String(topic.capHours) : "");
  const [localDiscount, setLocalDiscount] = useState<string>(topic.discountValue != null ? String(topic.discountValue) : "");

  useEffect(() => { setLocalRate(topic.hourlyRate != null ? String(topic.hourlyRate) : ""); }, [topic.hourlyRate]);
  useEffect(() => { setLocalFee(topic.fixedFee != null ? String(topic.fixedFee) : ""); }, [topic.fixedFee]);
  useEffect(() => { setLocalCap(topic.capHours != null ? String(topic.capHours) : ""); }, [topic.capHours]);
  useEffect(() => { setLocalDiscount(topic.discountValue != null ? String(topic.discountValue) : ""); }, [topic.discountValue]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sortableId || topic.id, disabled: !isEditable });

  const { setNodeRef: setDroppableRef, isOver: isDropTarget } = useDroppable({
    id: `topic-drop:${topic.id}`,
    disabled: !isEditable,
  });

  const { setNodeRef: setEmptyDropRef, isOver: isEmptyDropTarget } = useDroppable({
    id: `topic-empty:${topic.id}`,
    disabled: !isEditable || topic.lineItems.length > 0,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  // Calculate totals
  const rawHours = topic.lineItems
    .filter((item) => item.waiveMode !== "EXCLUDED")
    .reduce((sum, item) => sum + (item.waiveMode === "ZERO" ? 0 : (item.hours || 0)), 0);
  const waivedHours = topic.lineItems.reduce((sum, item) => {
    if (item.waiveMode === "EXCLUDED") return sum + (item.hours || 0);
    if (item.waiveMode === "ZERO") return sum + (item.hours || 0);
    return sum;
  }, 0);
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
      const parsed = parseFloat(value);
      const rate = !isNaN(parsed) ? parsed : null;
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
      const parsed = parseFloat(value);
      const fee = !isNaN(parsed) ? parsed : null;
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
      const parsed = parseFloat(value);
      const cap = !isNaN(parsed) ? parsed : null;
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
        } else if (topic.discountValue) {
          // Has an existing value — just change the type
          await onUpdateTopic(topic.id, { discountType: type, discountValue: topic.discountValue });
        } else {
          // No value yet — set type only, value will be sent when user enters one
          await onUpdateTopic(topic.id, { discountType: type, discountValue: null });
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
      const parsed = parseFloat(value);
      const val = !isNaN(parsed) ? parsed : null;
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
    <div ref={setNodeRef} style={style} className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
      {/* Header */}
      <div
        ref={setDroppableRef}
        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-surface)] transition-colors ${
          isDropTarget ? "bg-[var(--accent-pink-glow)] ring-1 ring-[var(--accent-pink)]" : ""
        }`}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          {isEditable && (
            <button
              {...attributes}
              {...listeners}
              className="p-1 -ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing touch-none"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="5" r="1.5" />
                <circle cx="15" cy="5" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="19" r="1.5" />
                <circle cx="15" cy="19" r="1.5" />
              </svg>
            </button>
          )}
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
            {waivedHours > 0 && (
              <span className="text-xs text-[var(--text-muted)] ml-1">
                ({formatHours(waivedHours)} waived)
              </span>
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
                  baseTotal - topicTotal
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left column: Pricing */}
              <div className="border border-[var(--border-subtle)] rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Pricing</h4>

                {/* Mode toggle */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Mode</label>
                  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePricingModeChange("HOURLY"); }}
                      disabled={!isEditable || isUpdating}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        topic.pricingMode === "HOURLY"
                          ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                          : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      Hourly
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePricingModeChange("FIXED"); }}
                      disabled={!isEditable || isUpdating}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        topic.pricingMode === "FIXED"
                          ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                          : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      Fixed
                    </button>
                  </div>
                </div>

                {/* Rate or Fee */}
                {topic.pricingMode === "HOURLY" ? (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Rate</label>
                    <input
                      type="number"
                      value={localRate}
                      onChange={(e) => setLocalRate(e.target.value)}
                      onBlur={(e) => handleHourlyRateChange(e.target.value)}
                      disabled={!isEditable}
                      placeholder={clientHourlyRate ? String(clientHourlyRate) : "0"}
                      className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
                      step="0.01"
                      min="0"
                    />
                    <span className="text-xs text-[var(--text-muted)]">EUR/h</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Fee</label>
                    <input
                      type="number"
                      value={localFee}
                      onChange={(e) => setLocalFee(e.target.value)}
                      onBlur={(e) => handleFixedFeeChange(e.target.value)}
                      disabled={!isEditable}
                      placeholder="0"
                      className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
                      step="0.01"
                      min="0"
                    />
                    <span className="text-xs text-[var(--text-muted)]">EUR</span>
                  </div>
                )}
              </div>

              {/* Right column: Adjustments */}
              <div className="border border-[var(--border-subtle)] rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Adjustments</h4>

                {/* Cap (HOURLY only) */}
                {topic.pricingMode === "HOURLY" && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Cap</label>
                    <input
                      type="number"
                      value={localCap}
                      onChange={(e) => setLocalCap(e.target.value)}
                      onBlur={(e) => handleCapHoursChange(e.target.value)}
                      disabled={!isEditable}
                      placeholder="No cap"
                      className="w-24 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
                      step="0.25"
                      min="0"
                    />
                    <span className="text-xs text-[var(--text-muted)]">hrs</span>
                  </div>
                )}

                {/* Discount */}
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[var(--text-secondary)] w-16 shrink-0">Discount</label>
                  <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDiscountTypeChange(topic.discountType === "PERCENTAGE" ? null : "PERCENTAGE"); }}
                      disabled={!isEditable || isUpdating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        topic.discountType === "PERCENTAGE"
                          ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                          : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      } ${!isEditable ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      %
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDiscountTypeChange(topic.discountType === "AMOUNT" ? null : "AMOUNT"); }}
                      disabled={!isEditable || isUpdating}
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
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
                      value={localDiscount}
                      onChange={(e) => setLocalDiscount(e.target.value)}
                      onBlur={(e) => handleDiscountValueChange(e.target.value)}
                      disabled={!isEditable}
                      placeholder="0"
                      className="w-20 px-2 py-1.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] disabled:opacity-60 disabled:cursor-not-allowed"
                      step="0.01"
                      min="0"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line items */}
          {topic.lineItems.length === 0 ? (
            <div className="p-6">
              {isEditable ? (
                <div ref={setEmptyDropRef} className={isEmptyDropTarget ? "rounded-lg ring-1 ring-[var(--accent-pink)] bg-[var(--accent-pink-glow)]" : ""}>
                  <button
                    onClick={handleOpenAddItem}
                    className="w-full py-6 border-2 border-dashed border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Line Item
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-[var(--text-muted)] italic">No line items</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-[var(--text-muted)] uppercase tracking-wide">
                    {isEditable && <th className="px-2 py-2.5 w-8"></th>}
                    <th className="px-4 py-2.5 text-left font-medium w-24">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium w-28">Lawyer</th>
                    <th className="px-4 py-2.5 text-left font-medium">Description</th>
                    <th className="px-4 py-2.5 text-right font-medium w-24">Hours</th>
                    {isEditable && <th className="px-4 py-2.5 text-right font-medium w-10"></th>}
                  </tr>
                </thead>
                <SortableContext
                  items={topic.lineItems.map((item) => `item:${item.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <tbody>
                    {topic.lineItems.map((item, index) => (
                      <LineItemRow
                        key={item.id}
                        item={item}
                        sortableId={`item:${item.id}`}
                        isEditable={isEditable}
                        isEvenRow={index % 2 === 0}
                        onUpdate={handleUpdateItem}
                        onDelete={handleDeleteItem}
                        onWaive={onWaive}
                      />
                    ))}
                  </tbody>
                </SortableContext>
                {isEditable && (
                  <tfoot>
                    <tr className="border-t border-[var(--border-subtle)]">
                      <td colSpan={isEditable ? 6 : 4}>
                        <button
                          onClick={handleOpenAddItem}
                          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors w-full"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Add Line Item
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
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
});
