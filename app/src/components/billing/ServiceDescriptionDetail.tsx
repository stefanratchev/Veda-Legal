"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ServiceDescription, ServiceDescriptionTopic, PricingMode } from "@/types";
import { calculateTopicTotal, calculateGrandTotal, formatCurrency } from "@/lib/billing-pdf";
import { TopicSection } from "./TopicSection";
import { AddTopicModal } from "./AddTopicModal";

interface ServiceDescriptionDetailProps {
  serviceDescription: ServiceDescription;
}

function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startMonth = startDate.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const endMonth = endDate.toLocaleString("en-GB", { month: "long", year: "numeric" });
  if (startMonth === endMonth) return startMonth;
  return `${startMonth} - ${endMonth}`;
}

export function ServiceDescriptionDetail({ serviceDescription: initialData }: ServiceDescriptionDetailProps) {
  const router = useRouter();
  const [data, setData] = useState<ServiceDescription>(initialData);
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [addTopicError, setAddTopicError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const isFinalized = data.status === "FINALIZED";
  const isEditable = !isFinalized;

  // Calculate totals
  const topicTotals = useMemo(() => {
    return data.topics.map((topic) => ({
      id: topic.id,
      name: topic.topicName,
      total: calculateTopicTotal(topic),
    }));
  }, [data.topics]);

  const subtotal = useMemo(() => {
    return topicTotals.reduce((sum, t) => sum + t.total, 0);
  }, [topicTotals]);

  const grandTotal = useMemo(() => {
    return calculateGrandTotal(data.topics, data.discountType, data.discountValue);
  }, [data.topics, data.discountType, data.discountValue]);

  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false);

  const handleOverallDiscountTypeChange = useCallback(
    async (type: "PERCENTAGE" | "AMOUNT" | null) => {
      setIsUpdatingDiscount(true);
      try {
        const payload = type
          ? { discountType: type, discountValue: data.discountValue || null }
          : { discountType: null, discountValue: null };
        const response = await fetch(`/api/billing/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.ok) {
          setData((prev) => ({
            ...prev,
            discountType: type,
            discountValue: type ? prev.discountValue : null,
          }));
        }
      } catch (error) {
        console.error("Failed to update discount:", error);
      } finally {
        setIsUpdatingDiscount(false);
      }
    },
    [data.id, data.discountValue]
  );

  const handleOverallDiscountValueChange = useCallback(
    async (value: string) => {
      const val = parseFloat(value) || null;
      setIsUpdatingDiscount(true);
      try {
        const response = await fetch(`/api/billing/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discountType: data.discountType,
            discountValue: val,
          }),
        });
        if (response.ok) {
          setData((prev) => ({ ...prev, discountValue: val }));
        }
      } catch (error) {
        console.error("Failed to update discount value:", error);
      } finally {
        setIsUpdatingDiscount(false);
      }
    },
    [data.id, data.discountType]
  );

  // Navigate back
  const handleBack = useCallback(() => {
    router.push("/billing");
  }, [router]);

  // Add topic
  const handleOpenAddTopic = useCallback(() => {
    setAddTopicError(null);
    setShowAddTopicModal(true);
  }, []);

  const handleCloseAddTopic = useCallback(() => {
    setShowAddTopicModal(false);
    setAddTopicError(null);
  }, []);

  const handleAddTopic = useCallback(
    async (topicName: string, pricingMode: PricingMode, hourlyRate: number | null, fixedFee: number | null, capHours: number | null, discountType: "PERCENTAGE" | "AMOUNT" | null, discountValue: number | null) => {
      setIsAddingTopic(true);
      setAddTopicError(null);

      try {
        const response = await fetch(`/api/billing/${data.id}/topics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicName, pricingMode, hourlyRate, fixedFee, capHours, discountType, discountValue }),
        });

        const result = await response.json();

        if (!response.ok) {
          setAddTopicError(result.error || "Failed to add topic");
          return;
        }

        // Add the new topic to state
        setData((prev) => ({
          ...prev,
          topics: [...prev.topics, { ...result, lineItems: [] }],
        }));

        setShowAddTopicModal(false);
      } catch {
        setAddTopicError("Failed to add topic");
      } finally {
        setIsAddingTopic(false);
      }
    },
    [data.id]
  );

  // Update topic
  const handleUpdateTopic = useCallback(
    async (topicId: string, updates: Partial<ServiceDescriptionTopic>) => {
      try {
        const response = await fetch(`/api/billing/${data.id}/topics/${topicId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to update topic");
        }

        const result = await response.json();

        setData((prev) => ({
          ...prev,
          topics: prev.topics.map((t) =>
            t.id === topicId
              ? { ...t, ...result }
              : t
          ),
        }));
      } catch (error) {
        console.error("Failed to update topic:", error);
        throw error;
      }
    },
    [data.id]
  );

  // Delete topic
  const handleDeleteTopic = useCallback(
    async (topicId: string) => {
      if (!confirm("Delete this topic and all its line items?")) return;

      try {
        const response = await fetch(`/api/billing/${data.id}/topics/${topicId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setData((prev) => ({
            ...prev,
            topics: prev.topics.filter((t) => t.id !== topicId),
          }));
        }
      } catch (error) {
        console.error("Failed to delete topic:", error);
      }
    },
    [data.id]
  );

  // Add line item
  const handleAddLineItem = useCallback(
    async (topicId: string, itemData: { date?: string; description: string; hours?: number; fixedAmount?: number }) => {
      try {
        const response = await fetch(`/api/billing/${data.id}/topics/${topicId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemData),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to add line item");
        }

        const result = await response.json();

        setData((prev) => ({
          ...prev,
          topics: prev.topics.map((t) =>
            t.id === topicId
              ? { ...t, lineItems: [...t.lineItems, result] }
              : t
          ),
        }));
      } catch (error) {
        console.error("Failed to add line item:", error);
        throw error;
      }
    },
    [data.id]
  );

  // Update line item
  const handleUpdateLineItem = useCallback(
    async (topicId: string, itemId: string, updates: { description?: string; hours?: number }) => {
      try {
        const response = await fetch(`/api/billing/${data.id}/topics/${topicId}/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to update line item");
        }

        const result = await response.json();

        setData((prev) => ({
          ...prev,
          topics: prev.topics.map((t) =>
            t.id === topicId
              ? {
                  ...t,
                  lineItems: t.lineItems.map((item) =>
                    item.id === itemId ? { ...item, ...result } : item
                  ),
                }
              : t
          ),
        }));
      } catch (error) {
        console.error("Failed to update line item:", error);
        throw error;
      }
    },
    [data.id]
  );

  // Delete line item
  const handleDeleteLineItem = useCallback(
    async (topicId: string, itemId: string) => {
      try {
        const response = await fetch(`/api/billing/${data.id}/topics/${topicId}/items/${itemId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setData((prev) => ({
            ...prev,
            topics: prev.topics.map((t) =>
              t.id === topicId
                ? { ...t, lineItems: t.lineItems.filter((item) => item.id !== itemId) }
                : t
            ),
          }));
        }
      } catch (error) {
        console.error("Failed to delete line item:", error);
      }
    },
    [data.id]
  );

  // Finalize / Unlock
  const handleToggleStatus = useCallback(async () => {
    const newStatus = isFinalized ? "DRAFT" : "FINALIZED";
    const action = isFinalized ? "unlock" : "finalize";

    if (!isFinalized && !confirm("Finalize this service description? It will become read-only until unlocked.")) {
      return;
    }

    setIsUpdatingStatus(true);

    try {
      const response = await fetch(`/api/billing/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const result = await response.json();
        setData((prev) => ({
          ...prev,
          status: result.status,
          finalizedAt: result.finalizedAt,
        }));
      } else {
        const result = await response.json();
        alert(result.error || `Failed to ${action} service description`);
      }
    } catch {
      alert(`Failed to ${action} service description`);
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [data.id, isFinalized]);

  // Export PDF
  const handleExportPDF = useCallback(async () => {
    try {
      const response = await fetch(`/api/billing/${data.id}/pdf`);
      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Service_Description_${(data.client.invoicedName || data.client.name).replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export PDF. Please try again.");
    }
  }, [data.id, data.client.invoicedName, data.client.name]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            title="Back to billing"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
                {data.client.invoicedName || data.client.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded ${
                  isFinalized
                    ? "bg-[var(--success-bg)] text-[var(--success)]"
                    : "bg-[var(--warning-bg)] text-[var(--warning)]"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isFinalized ? "var(--success)" : "var(--warning)" }}
                />
                {isFinalized ? "Finalized" : "Draft"}
              </span>
            </div>
            <p className="text-[var(--text-muted)] text-sm mt-0.5">
              {formatPeriod(data.periodStart, data.periodEnd)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wide">Total</p>
          <p className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
            {formatCurrency(grandTotal)}
          </p>
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] p-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Summary</h2>
        <div className="space-y-2">
          {topicTotals.map((topic) => (
            <div key={topic.id} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-primary)]">{topic.name}</span>
              <span className="text-[var(--text-secondary)]">{formatCurrency(topic.total)}</span>
            </div>
          ))}
          {topicTotals.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] italic">No topics yet</p>
          )}
          {/* Overall discount controls (DRAFT only) */}
          {isEditable && topicTotals.length > 0 && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)]">Overall Discount:</span>
                <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                  <button
                    onClick={() => handleOverallDiscountTypeChange(data.discountType === "PERCENTAGE" ? null : "PERCENTAGE")}
                    disabled={isUpdatingDiscount}
                    className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                      data.discountType === "PERCENTAGE"
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                    }`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => handleOverallDiscountTypeChange(data.discountType === "AMOUNT" ? null : "AMOUNT")}
                    disabled={isUpdatingDiscount}
                    className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                      data.discountType === "AMOUNT"
                        ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                        : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                    }`}
                  >
                    EUR
                  </button>
                </div>
                {data.discountType && (
                  <input
                    type="number"
                    value={data.discountValue ?? ""}
                    onChange={(e) => handleOverallDiscountValueChange(e.target.value)}
                    placeholder="0"
                    className="w-20 px-2 py-0.5 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                    step="0.01"
                    min="0"
                  />
                )}
              </div>
              {data.discountType && data.discountValue ? (
                <span className="text-[var(--text-secondary)]">
                  -{formatCurrency(data.discountType === "PERCENTAGE" ? subtotal * data.discountValue / 100 : data.discountValue)}
                </span>
              ) : null}
            </div>
          )}
          {/* Show discount info when finalized */}
          {!isEditable && data.discountType && data.discountValue && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)]">
                Overall Discount ({data.discountType === "PERCENTAGE" ? `${data.discountValue}%` : formatCurrency(data.discountValue)})
              </span>
              <span className="text-[var(--text-secondary)]">
                -{formatCurrency(data.discountType === "PERCENTAGE" ? subtotal * data.discountValue / 100 : data.discountValue)}
              </span>
            </div>
          )}
          {topicTotals.length > 0 && (
            <>
              {data.discountType && data.discountValue ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Subtotal</span>
                    <span className="text-[var(--text-secondary)]">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-medium pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[var(--text-primary)]">Total</span>
                    <span className="text-[var(--text-primary)]">{formatCurrency(grandTotal)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-sm font-medium pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-primary)]">Total</span>
                  <span className="text-[var(--text-primary)]">{formatCurrency(grandTotal)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Topic Sections */}
      <div className="space-y-4">
        {data.topics.map((topic) => (
          <TopicSection
            key={topic.id}
            topic={topic}
            serviceDescriptionId={data.id}
            isEditable={isEditable}
            clientHourlyRate={data.client.hourlyRate}
            onUpdateTopic={handleUpdateTopic}
            onDeleteTopic={handleDeleteTopic}
            onAddLineItem={handleAddLineItem}
            onUpdateLineItem={handleUpdateLineItem}
            onDeleteLineItem={handleDeleteLineItem}
          />
        ))}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
        <div>
          {isEditable && (
            <button
              onClick={handleOpenAddTopic}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Topic
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded hover:bg-[var(--bg-surface)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </button>
          <button
            onClick={handleToggleStatus}
            disabled={isUpdatingStatus}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded transition-colors disabled:opacity-50 ${
              isFinalized
                ? "text-[var(--warning)] border border-[var(--warning)] hover:bg-[var(--warning-bg)]"
                : "bg-[var(--accent-pink)] text-[var(--bg-deep)] hover:bg-[var(--accent-pink-dim)]"
            }`}
          >
            {isUpdatingStatus ? (
              "..."
            ) : isFinalized ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Unlock
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Finalize
              </>
            )}
          </button>
        </div>
      </div>

      {/* Add Topic Modal */}
      {showAddTopicModal && (
        <AddTopicModal
          isLoading={isAddingTopic}
          error={addTopicError}
          defaultHourlyRate={data.client.hourlyRate}
          onSubmit={handleAddTopic}
          onClose={handleCloseAddTopic}
        />
      )}
    </div>
  );
}
