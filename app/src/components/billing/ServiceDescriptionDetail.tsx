"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ServiceDescription, ServiceDescriptionTopic, PricingMode, WriteOffAction } from "@/types";
import { calculateTopicTotal, calculateGrandTotal, calculateRetainerSummary, formatCurrency } from "@/lib/billing-pdf";
import { TopicSection } from "./TopicSection";
import { AddTopicModal } from "./AddTopicModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

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
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
  const [lineItemToDelete, setLineItemToDelete] = useState<{ topicId: string; itemId: string } | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  const isFinalized = data.status === "FINALIZED";
  const isEditable = !isFinalized;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Ref to always read latest data in drag handlers (avoids stale closures)
  const dataRef = useRef(data);
  dataRef.current = data;

  // Custom collision detection: filter droppables by active drag type
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = String(args.active.id);
    if (activeId.startsWith("topic:")) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => String(c.id).startsWith("topic:")
        ),
      });
    }
    // For items: consider item sortables + topic drop/empty zones, not topic sortables
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => !String(c.id).startsWith("topic:")
      ),
    });
  }, []);

  const [activeDragType, setActiveDragType] = useState<"topic" | "item" | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith("topic:")) {
      setActiveDragType("topic");
      setActiveTopicId(id.replace("topic:", ""));
    } else if (id.startsWith("item:")) {
      setActiveDragType("item");
      setActiveItemId(id.replace("item:", ""));
    }
  }, []);

  const handleTopicReorder = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentData = dataRef.current;
    const activeId = String(active.id).replace("topic:", "");
    const overId = String(over.id).replace("topic:", "");

    const oldIndex = currentData.topics.findIndex((t) => t.id === activeId);
    const newIndex = currentData.topics.findIndex((t) => t.id === overId);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentData.topics, oldIndex, newIndex);
    const previousTopics = currentData.topics;

    const updates: { id: string; displayOrder: number }[] = [];
    reordered.forEach((topic, index) => {
      if (topic.displayOrder !== index) {
        updates.push({ id: topic.id, displayOrder: index });
      }
    });

    if (updates.length === 0) return;

    // Optimistic update
    setData((prev) => ({
      ...prev,
      topics: reordered.map((t, i) => ({ ...t, displayOrder: i })),
    }));

    try {
      const response = await fetch(`/api/billing/${currentData.id}/topics/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updates }),
      });

      if (!response.ok) {
        setData((prev) => ({ ...prev, topics: previousTopics }));
        alert("Failed to reorder topics. Changes have been reverted.");
      }
    } catch {
      setData((prev) => ({ ...prev, topics: previousTopics }));
      alert("Failed to reorder topics. Changes have been reverted.");
    }
  }, []);

  const handleLineItemDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const currentData = dataRef.current;
    const activeId = String(active.id).replace("item:", "");
    const overId = String(over.id);

    // Find source topic containing the dragged item
    const sourceTopic = currentData.topics.find((t) =>
      t.lineItems.some((item) => item.id === activeId)
    );
    if (!sourceTopic) return;

    let targetTopicId: string;
    let insertIndex: number | null = null;

    if (overId.startsWith("topic-drop:")) {
      // Dropped on a topic header — append to that topic
      targetTopicId = overId.replace("topic-drop:", "");
    } else if (overId.startsWith("topic-empty:")) {
      // Dropped on an empty topic area — append to that topic
      targetTopicId = overId.replace("topic-empty:", "");
    } else if (overId.startsWith("item:")) {
      // Dropped on a line item — find which topic it's in
      const overItemId = overId.replace("item:", "");
      const targetTopic = currentData.topics.find((t) =>
        t.lineItems.some((item) => item.id === overItemId)
      );
      if (!targetTopic) return;
      targetTopicId = targetTopic.id;
      insertIndex = targetTopic.lineItems.findIndex((item) => item.id === overItemId);
    } else {
      return;
    }

    if (active.id === over.id) return;

    const previousTopics = currentData.topics;

    const revertWithError = () => {
      setData((prev) => ({ ...prev, topics: previousTopics }));
      alert("Failed to reorder line items. Changes have been reverted.");
    };

    if (sourceTopic.id === targetTopicId) {
      // Within same topic — reorder
      if (insertIndex === null) return; // dropped on own header, no-op
      const items = [...sourceTopic.lineItems];
      const oldIndex = items.findIndex((item) => item.id === activeId);
      if (oldIndex === -1 || oldIndex === insertIndex) return;

      const reordered = arrayMove(items, oldIndex, insertIndex);
      const updates = reordered.map((item, i) => ({
        id: item.id,
        topicId: sourceTopic.id,
        displayOrder: i,
      }));

      setData((prev) => ({
        ...prev,
        topics: prev.topics.map((t) =>
          t.id === sourceTopic.id
            ? { ...t, lineItems: reordered.map((item, i) => ({ ...item, displayOrder: i })) }
            : t
        ),
      }));

      try {
        const response = await fetch(`/api/billing/${currentData.id}/line-items/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updates }),
        });
        if (!response.ok) revertWithError();
      } catch {
        revertWithError();
      }
    } else {
      // Cross-topic move
      const movedItem = sourceTopic.lineItems.find((item) => item.id === activeId);
      if (!movedItem) return;

      const targetTopic = currentData.topics.find((t) => t.id === targetTopicId);
      if (!targetTopic) return;

      const newSourceItems = sourceTopic.lineItems.filter((item) => item.id !== activeId);
      const newTargetItems = [...targetTopic.lineItems];
      if (insertIndex !== null) {
        newTargetItems.splice(insertIndex, 0, movedItem);
      } else {
        newTargetItems.push(movedItem);
      }

      const updates: { id: string; topicId: string; displayOrder: number }[] = [];
      newSourceItems.forEach((item, i) => {
        updates.push({ id: item.id, topicId: sourceTopic.id, displayOrder: i });
      });
      newTargetItems.forEach((item, i) => {
        updates.push({ id: item.id, topicId: targetTopicId, displayOrder: i });
      });

      setData((prev) => ({
        ...prev,
        topics: prev.topics.map((t) => {
          if (t.id === sourceTopic.id) {
            return { ...t, lineItems: newSourceItems.map((item, i) => ({ ...item, displayOrder: i })) };
          }
          if (t.id === targetTopicId) {
            return { ...t, lineItems: newTargetItems.map((item, i) => ({ ...item, displayOrder: i })) };
          }
          return t;
        }),
      }));

      try {
        const response = await fetch(`/api/billing/${currentData.id}/line-items/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updates }),
        });
        if (!response.ok) revertWithError();
      } catch {
        revertWithError();
      }
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const dragType = activeDragType;
    setActiveDragType(null);
    setActiveTopicId(null);
    setActiveItemId(null);

    if (dragType === "topic") {
      handleTopicReorder(event);
    } else if (dragType === "item") {
      handleLineItemDragEnd(event);
    }
  }, [activeDragType, handleTopicReorder, handleLineItemDragEnd]);

  // Retainer mode detection
  const isRetainer = data.retainerFee != null && data.retainerHours != null;

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

  // Retainer summary (only computed when in retainer mode)
  const retainerSummary = useMemo(() => {
    if (!isRetainer) return null;
    return calculateRetainerSummary(
      data.topics, data.retainerFee!, data.retainerHours!,
      data.retainerOverageRate || 0, data.discountType, data.discountValue,
    );
  }, [data.topics, data.discountType, data.discountValue, isRetainer, data.retainerFee, data.retainerHours, data.retainerOverageRate]);

  const grandTotal = useMemo(() => {
    if (retainerSummary) return retainerSummary.grandTotal;
    return calculateGrandTotal(data.topics, data.discountType, data.discountValue);
  }, [retainerSummary, data.topics, data.discountType, data.discountValue]);

  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false);
  const [localOverallDiscount, setLocalOverallDiscount] = useState<string>(data.discountValue != null ? String(data.discountValue) : "");
  useEffect(() => { setLocalOverallDiscount(data.discountValue != null ? String(data.discountValue) : ""); }, [data.discountValue]);

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
      const parsed = parseFloat(value);
      const val = !isNaN(parsed) ? parsed : null;
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
  const handleDeleteTopic = useCallback((topicId: string) => {
    setTopicToDelete(topicId);
  }, []);

  const handleConfirmDeleteTopic = useCallback(async () => {
    if (!topicToDelete) return;
    const topicId = topicToDelete;
    setTopicToDelete(null);

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
  }, [data.id, topicToDelete]);

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

  // Write off / restore line item
  const handleWriteOffLineItem = useCallback(
    async (itemId: string, writeOff: WriteOffAction | null) => {
      const currentData = dataRef.current;
      const topic = currentData.topics.find((t) =>
        t.lineItems.some((li) => li.id === itemId)
      );
      if (!topic) return;

      const response = await fetch(
        `/api/billing/${currentData.id}/topics/${topic.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ writeOff }),
        }
      );

      if (!response.ok) throw new Error("Failed to update write-off status");

      const result = await response.json();

      setData((prev) => ({
        ...prev,
        topics: prev.topics.map((t) =>
          t.id === topic.id
            ? {
                ...t,
                lineItems: t.lineItems.map((item) =>
                  item.id === itemId ? { ...item, ...result } : item
                ),
              }
            : t
        ),
      }));
    },
    []
  );

  // Remove line item from invoice (no confirmation — already confirmed via modal)
  const handleRemoveLineItem = useCallback(async (topicId: string, itemId: string) => {
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
      console.error("Failed to remove line item:", error);
    }
  }, [data.id]);

  // Delete line item (with confirmation — for manual items)
  const handleDeleteLineItem = useCallback((topicId: string, itemId: string) => {
    setLineItemToDelete({ topicId, itemId });
  }, []);

  const handleConfirmDeleteLineItem = useCallback(async () => {
    if (!lineItemToDelete) return;
    const { topicId, itemId } = lineItemToDelete;
    setLineItemToDelete(null);

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
  }, [data.id, lineItemToDelete]);

  // Finalize / Unlock
  const performToggleStatus = useCallback(async () => {
    setShowFinalizeConfirm(false);
    const newStatus = isFinalized ? "DRAFT" : "FINALIZED";
    const action = isFinalized ? "unlock" : "finalize";

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

  const handleToggleStatus = useCallback(() => {
    if (!isFinalized) {
      setShowFinalizeConfirm(true);
      return;
    }
    performToggleStatus();
  }, [isFinalized, performToggleStatus]);

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
          <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
            {data.client.invoicedName || data.client.name}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[var(--text-muted)] text-base">
              {formatPeriod(data.periodStart, data.periodEnd)}
            </p>
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
        </div>
      </div>

      {/* Client Notes */}
      <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] overflow-hidden">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--bg-surface)] transition-colors"
          onClick={() => setNotesExpanded((v) => !v)}
        >
          <svg
            className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${notesExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">Client Notes</h2>
          <span className="text-xs text-[var(--text-muted)] italic">
            {data.client.notes?.trim() ? "Notes available" : "None"}
          </span>
        </div>
        {notesExpanded && (
          <div className="border-t border-[var(--border-subtle)] px-4 py-3">
            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-words">
              {data.client.notes?.trim() ? data.client.notes : "No client notes"}
            </p>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] p-5">
        <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Summary</h2>
        <div className="space-y-2.5">
          {isRetainer && retainerSummary ? (
            /* ---- Retainer Summary ---- */
            <>
              {/* Retainer package */}
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-[var(--text-primary)] shrink-0">
                  Monthly Retainer ({retainerSummary.retainerHours}h included)
                </span>
                <span className="flex-1 border-b border-dotted border-[var(--border-subtle)]" />
                <span className="text-[var(--text-secondary)] shrink-0 [font-variant-numeric:tabular-nums]">
                  {formatCurrency(retainerSummary.retainerFee)}
                </span>
              </div>

              {/* Hours used */}
              <div className="flex items-baseline gap-2 text-sm">
                <span className="text-[var(--text-muted)] shrink-0">
                  Hours Used: {retainerSummary.totalHourlyHours.toFixed(2)} of {retainerSummary.retainerHours}
                </span>
                <span className="flex-1" />
                <span className={`text-xs shrink-0 ${
                  retainerSummary.overageHours > 0
                    ? "text-[var(--warning)]"
                    : "text-[var(--success)]"
                }`}>
                  {retainerSummary.overageHours > 0
                    ? `${retainerSummary.overageHours.toFixed(2)}h over`
                    : `${(retainerSummary.retainerHours - retainerSummary.totalHourlyHours).toFixed(2)}h remaining`}
                </span>
              </div>

              {/* Overage line (only if over) */}
              {retainerSummary.overageHours > 0 && (
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-[var(--text-primary)] shrink-0">
                    Overage ({retainerSummary.overageHours.toFixed(2)}h @ {formatCurrency(retainerSummary.overageRate)}/h)
                  </span>
                  <span className="flex-1 border-b border-dotted border-[var(--border-subtle)]" />
                  <span className="text-[var(--text-secondary)] shrink-0 [font-variant-numeric:tabular-nums]">
                    {formatCurrency(retainerSummary.overageAmount)}
                  </span>
                </div>
              )}

              {/* Fixed topic fees (if any) */}
              {retainerSummary.fixedTopicFees > 0 && (
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-[var(--text-primary)] shrink-0">Fixed Fee Topics</span>
                  <span className="flex-1 border-b border-dotted border-[var(--border-subtle)]" />
                  <span className="text-[var(--text-secondary)] shrink-0 [font-variant-numeric:tabular-nums]">
                    {formatCurrency(retainerSummary.fixedTopicFees)}
                  </span>
                </div>
              )}

              {/* Fixed line item fees (if any) */}
              {retainerSummary.fixedLineItemFees > 0 && (
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="text-[var(--text-primary)] shrink-0">Fixed Fee Items</span>
                  <span className="flex-1 border-b border-dotted border-[var(--border-subtle)]" />
                  <span className="text-[var(--text-secondary)] shrink-0 [font-variant-numeric:tabular-nums]">
                    {formatCurrency(retainerSummary.fixedLineItemFees)}
                  </span>
                </div>
              )}

              {/* Subtotal */}
              <div className="flex items-center justify-between text-sm pt-3 border-t border-[var(--border-subtle)]">
                <span className="text-[var(--text-secondary)]">Subtotal</span>
                <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
                  {formatCurrency(retainerSummary.subtotal)}
                </span>
              </div>

              {/* Discount controls (DRAFT only) */}
              {isEditable && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--text-muted)]">Overall Discount</span>
                    <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                      <button
                        onClick={() => handleOverallDiscountTypeChange(data.discountType === "PERCENTAGE" ? null : "PERCENTAGE")}
                        disabled={isUpdatingDiscount}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
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
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
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
                        value={localOverallDiscount}
                        onChange={(e) => setLocalOverallDiscount(e.target.value)}
                        onBlur={(e) => handleOverallDiscountValueChange(e.target.value)}
                        placeholder="0"
                        className="w-20 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                        step="0.01"
                        min="0"
                      />
                    )}
                  </div>
                  {data.discountType && data.discountValue ? (
                    <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
                      -{formatCurrency(retainerSummary.subtotal - retainerSummary.grandTotal)}
                    </span>
                  ) : null}
                </div>
              )}

              {/* Discount display when finalized */}
              {!isEditable && data.discountType && data.discountValue && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">
                    Overall Discount ({data.discountType === "PERCENTAGE" ? `${data.discountValue}%` : formatCurrency(data.discountValue)})
                  </span>
                  <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
                    -{formatCurrency(retainerSummary.subtotal - retainerSummary.grandTotal)}
                  </span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                <span className="text-lg font-semibold text-[var(--text-primary)]">Total</span>
                <span className="text-lg font-semibold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
                  {formatCurrency(retainerSummary.grandTotal)}
                </span>
              </div>
            </>
          ) : (
            /* ---- Standard (Non-Retainer) Summary ---- */
            <>
              {/* Topic rows with dotted leaders */}
              {topicTotals.map((topic) => (
                <div key={topic.id} className="flex items-baseline gap-2 text-sm">
                  <span className="text-[var(--text-primary)] shrink-0">{topic.name}</span>
                  <span className="flex-1 border-b border-dotted border-[var(--border-subtle)]" />
                  <span className="text-[var(--text-secondary)] shrink-0 [font-variant-numeric:tabular-nums]">
                    {formatCurrency(topic.total)}
                  </span>
                </div>
              ))}
              {topicTotals.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] italic">No topics yet</p>
              )}

              {/* Subtotal + Discount + Grand Total */}
              {topicTotals.length > 0 && (
                <>
                  {/* Subtotal - always shown */}
                  <div className="flex items-center justify-between text-sm pt-3 border-t border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]">Subtotal</span>
                    <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>

                  {/* Discount controls (DRAFT only) */}
                  {isEditable && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--text-muted)]">Overall Discount</span>
                        <div className="flex rounded overflow-hidden border border-[var(--border-subtle)]">
                          <button
                            onClick={() => handleOverallDiscountTypeChange(data.discountType === "PERCENTAGE" ? null : "PERCENTAGE")}
                            disabled={isUpdatingDiscount}
                            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
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
                            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
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
                            value={localOverallDiscount}
                            onChange={(e) => setLocalOverallDiscount(e.target.value)}
                            onBlur={(e) => handleOverallDiscountValueChange(e.target.value)}
                            placeholder="0"
                            className="w-20 px-2 py-1 text-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
                            step="0.01"
                            min="0"
                          />
                        )}
                      </div>
                      {data.discountType && data.discountValue ? (
                        <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
                          -{formatCurrency(subtotal - grandTotal)}
                        </span>
                      ) : null}
                    </div>
                  )}

                  {/* Discount display when finalized */}
                  {!isEditable && data.discountType && data.discountValue && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-muted)]">
                        Overall Discount ({data.discountType === "PERCENTAGE" ? `${data.discountValue}%` : formatCurrency(data.discountValue)})
                      </span>
                      <span className="text-[var(--text-secondary)] [font-variant-numeric:tabular-nums]">
                        -{formatCurrency(subtotal - grandTotal)}
                      </span>
                    </div>
                  )}

                  {/* Grand Total */}
                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                    <span className="text-lg font-semibold text-[var(--text-primary)]">Total</span>
                    <span className="text-lg font-semibold text-[var(--text-primary)] [font-variant-numeric:tabular-nums]">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Topic Sections */}
      <div className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={data.topics.map((t) => `topic:${t.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {data.topics.map((topic) => (
              <TopicSection
                key={topic.id}
                topic={topic}
                sortableId={`topic:${topic.id}`}
                serviceDescriptionId={data.id}
                isEditable={isEditable}
                clientHourlyRate={data.client.hourlyRate}
                onUpdateTopic={handleUpdateTopic}
                onDeleteTopic={handleDeleteTopic}
                onAddLineItem={handleAddLineItem}
                onUpdateLineItem={handleUpdateLineItem}
                onRemoveLineItem={handleRemoveLineItem}
                onDeleteLineItem={handleDeleteLineItem}
                onWriteOff={handleWriteOffLineItem}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeTopicId ? (
              <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--accent-pink)] p-4 opacity-90 shadow-lg">
                <span className="font-heading text-base font-semibold text-[var(--text-primary)]">
                  {data.topics.find((t) => t.id === activeTopicId)?.topicName}
                </span>
              </div>
            ) : activeItemId ? (() => {
              const item = data.topics.flatMap((t) => t.lineItems).find((i) => i.id === activeItemId);
              if (!item) return null;
              return (
                <div className="bg-[var(--bg-elevated)] border border-[var(--accent-pink)] rounded px-4 py-2 shadow-lg opacity-90">
                  <span className="text-sm text-[var(--text-primary)]">{item.description}</span>
                  {item.hours != null && item.hours > 0 && (
                    <span className="text-sm text-[var(--text-muted)] ml-2">
                      {Math.floor(item.hours)}h {Math.round((item.hours - Math.floor(item.hours)) * 60)}m
                    </span>
                  )}
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>

        {/* Add Topic Button - dashed, inline with topics */}
        {isEditable && (
          <button
            onClick={handleOpenAddTopic}
            className="w-full py-3 border-2 border-dashed border-[var(--border-subtle)] rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Topic
          </button>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
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

      {/* Delete Topic Confirmation */}
      {topicToDelete && (
        <ConfirmModal
          title="Delete Topic"
          message="Delete this topic and all its line items? This action cannot be undone."
          confirmLabel="Delete"
          isDestructive
          onConfirm={handleConfirmDeleteTopic}
          onCancel={() => setTopicToDelete(null)}
        />
      )}

      {/* Delete Line Item Confirmation */}
      {lineItemToDelete && (
        <ConfirmModal
          title="Delete Line Item"
          message="Delete this line item? This action cannot be undone."
          confirmLabel="Delete"
          isDestructive
          onConfirm={handleConfirmDeleteLineItem}
          onCancel={() => setLineItemToDelete(null)}
        />
      )}

      {/* Finalize Confirmation */}
      {showFinalizeConfirm && (
        <ConfirmModal
          title="Finalize Service Description"
          message="Finalize this service description? It will become read-only until unlocked."
          confirmLabel="Finalize"
          onConfirm={performToggleStatus}
          onCancel={() => setShowFinalizeConfirm(false)}
        />
      )}
    </div>
  );
}
