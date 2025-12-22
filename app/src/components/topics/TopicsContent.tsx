"use client";

import { useState, useCallback } from "react";
import { TopicModal } from "./TopicModal";
import { SubtopicModal } from "./SubtopicModal";
import { Topic, Subtopic } from "@/types";

interface TopicsContentProps {
  initialTopics: Topic[];
}

export function TopicsContent({ initialTopics }: TopicsContentProps) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Topic modal state
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  // Subtopic modal state
  const [showSubtopicModal, setShowSubtopicModal] = useState(false);
  const [editingSubtopic, setEditingSubtopic] = useState<Subtopic | null>(null);

  // Derive effective selected topic ID (auto-select first if none selected)
  const effectiveSelectedTopicId =
    selectedTopicId && topics.some((t) => t.id === selectedTopicId)
      ? selectedTopicId
      : topics.length > 0
        ? topics[0].id
        : null;

  // Get selected topic
  const selectedTopic =
    topics.find((t) => t.id === effectiveSelectedTopicId) || null;

  // Topic CRUD handlers
  const openCreateTopic = useCallback(() => {
    setEditingTopic(null);
    setShowTopicModal(true);
  }, []);

  const openEditTopic = useCallback((topic: Topic) => {
    setEditingTopic(topic);
    setShowTopicModal(true);
  }, []);

  const closeTopicModal = useCallback(() => {
    setShowTopicModal(false);
    setEditingTopic(null);
  }, []);

  const handleSaveTopic = useCallback(
    async (data: { name: string }) => {
      setError(null);

      try {
        if (editingTopic) {
          // Update existing topic
          const response = await fetch(`/api/topics/${editingTopic.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          const result = await response.json();

          if (!response.ok) {
            setError(result.error || "Failed to update topic");
            return;
          }

          setTopics((prev) =>
            prev.map((t) => (t.id === editingTopic.id ? result : t))
          );
        } else {
          // Create new topic
          const response = await fetch("/api/topics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          const result = await response.json();

          if (!response.ok) {
            setError(result.error || "Failed to create topic");
            return;
          }

          setTopics((prev) => [...prev, result]);
          setSelectedTopicId(result.id);
        }

        closeTopicModal();
      } catch {
        setError("Failed to save topic");
      }
    },
    [editingTopic, closeTopicModal]
  );

  const toggleTopicStatus = useCallback(async (topic: Topic) => {
    const newStatus = topic.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      const response = await fetch(`/api/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (response.ok) {
        setTopics((prev) => prev.map((t) => (t.id === topic.id ? result : t)));
      }
    } catch {
      console.error("Failed to toggle topic status");
    }
  }, []);

  const deleteTopic = useCallback(
    async (topic: Topic) => {
      if (topic.subtopics.length > 0) {
        setError("Cannot delete topic with subtopics. Delete subtopics first.");
        return;
      }

      try {
        const response = await fetch(`/api/topics/${topic.id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setTopics((prev) => prev.filter((t) => t.id !== topic.id));
          if (selectedTopicId === topic.id) {
            setSelectedTopicId(null);
          }
          setError(null);
        } else {
          const result = await response.json();
          setError(result.error || "Failed to delete topic");
        }
      } catch {
        setError("Failed to delete topic");
      }
    },
    [selectedTopicId]
  );

  // Subtopic CRUD handlers
  const openCreateSubtopic = useCallback(() => {
    setEditingSubtopic(null);
    setShowSubtopicModal(true);
  }, []);

  const openEditSubtopic = useCallback((subtopic: Subtopic) => {
    setEditingSubtopic(subtopic);
    setShowSubtopicModal(true);
  }, []);

  const closeSubtopicModal = useCallback(() => {
    setShowSubtopicModal(false);
    setEditingSubtopic(null);
  }, []);

  const handleSaveSubtopic = useCallback(
    async (data: { name: string }) => {
      if (!effectiveSelectedTopicId) return;
      setError(null);

      try {
        if (editingSubtopic) {
          // Update existing subtopic
          const response = await fetch(`/api/subtopics/${editingSubtopic.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });

          const result = await response.json();

          if (!response.ok) {
            setError(result.error || "Failed to update subtopic");
            return;
          }

          // Update the topic's subtopics
          setTopics((prev) =>
            prev.map((t) =>
              t.id === effectiveSelectedTopicId
                ? {
                    ...t,
                    subtopics: t.subtopics.map((s) =>
                      s.id === editingSubtopic.id ? result : s
                    ),
                  }
                : t
            )
          );
        } else {
          // Create new subtopic
          const response = await fetch(
            `/api/topics/${effectiveSelectedTopicId}/subtopics`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            }
          );

          const result = await response.json();

          if (!response.ok) {
            setError(result.error || "Failed to create subtopic");
            return;
          }

          // Add subtopic to the topic
          setTopics((prev) =>
            prev.map((t) =>
              t.id === effectiveSelectedTopicId
                ? { ...t, subtopics: [...t.subtopics, result] }
                : t
            )
          );
        }

        closeSubtopicModal();
      } catch {
        setError("Failed to save subtopic");
      }
    },
    [effectiveSelectedTopicId, editingSubtopic, closeSubtopicModal]
  );

  const toggleSubtopicStatus = useCallback(
    async (subtopic: Subtopic) => {
      const newStatus = subtopic.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

      try {
        const response = await fetch(`/api/subtopics/${subtopic.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });

        const result = await response.json();

        if (response.ok) {
          setTopics((prev) =>
            prev.map((t) =>
              t.id === effectiveSelectedTopicId
                ? {
                    ...t,
                    subtopics: t.subtopics.map((s) =>
                      s.id === subtopic.id ? result : s
                    ),
                  }
                : t
            )
          );
        }
      } catch {
        console.error("Failed to toggle subtopic status");
      }
    },
    [effectiveSelectedTopicId]
  );

  const deleteSubtopic = useCallback(
    async (subtopic: Subtopic) => {
      try {
        const response = await fetch(`/api/subtopics/${subtopic.id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setTopics((prev) =>
            prev.map((t) =>
              t.id === effectiveSelectedTopicId
                ? {
                    ...t,
                    subtopics: t.subtopics.filter((s) => s.id !== subtopic.id),
                  }
                : t
            )
          );
          setError(null);
        } else {
          const result = await response.json();
          setError(result.error || "Failed to delete subtopic");
        }
      } catch {
        setError("Failed to delete subtopic");
      }
    },
    [effectiveSelectedTopicId]
  );

  // Reorder topic handler
  const moveTopicInDirection = useCallback(
    async (topic: Topic, direction: "up" | "down") => {
      // Get topics in the same status group, sorted by displayOrder
      const sameStatusTopics = topics
        .filter((t) => t.status === topic.status)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      const currentIndex = sameStatusTopics.findIndex((t) => t.id === topic.id);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= sameStatusTopics.length) return;

      const targetTopic = sameStatusTopics[targetIndex];
      const currentOrder = topic.displayOrder;
      const targetOrder = targetTopic.displayOrder;

      // Optimistically update UI
      setTopics((prev) =>
        prev.map((t) => {
          if (t.id === topic.id) return { ...t, displayOrder: targetOrder };
          if (t.id === targetTopic.id) return { ...t, displayOrder: currentOrder };
          return t;
        })
      );

      try {
        // Update both topics in parallel
        const [res1, res2] = await Promise.all([
          fetch(`/api/topics/${topic.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayOrder: targetOrder }),
          }),
          fetch(`/api/topics/${targetTopic.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayOrder: currentOrder }),
          }),
        ]);

        if (!res1.ok || !res2.ok) {
          // Revert on failure
          setTopics((prev) =>
            prev.map((t) => {
              if (t.id === topic.id) return { ...t, displayOrder: currentOrder };
              if (t.id === targetTopic.id) return { ...t, displayOrder: targetOrder };
              return t;
            })
          );
          setError("Failed to reorder topic");
        }
      } catch {
        // Revert on failure
        setTopics((prev) =>
          prev.map((t) => {
            if (t.id === topic.id) return { ...t, displayOrder: currentOrder };
            if (t.id === targetTopic.id) return { ...t, displayOrder: targetOrder };
            return t;
          })
        );
        setError("Failed to reorder topic");
      }
    },
    [topics]
  );

  // Reorder subtopic handler
  const moveSubtopicInDirection = useCallback(
    async (subtopic: Subtopic, direction: "up" | "down") => {
      if (!selectedTopic) return;

      // Get subtopics in the same status group, sorted by displayOrder
      const sameStatusSubtopics = selectedTopic.subtopics
        .filter((s) => s.status === subtopic.status)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      const currentIndex = sameStatusSubtopics.findIndex((s) => s.id === subtopic.id);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= sameStatusSubtopics.length) return;

      const targetSubtopic = sameStatusSubtopics[targetIndex];
      const currentOrder = subtopic.displayOrder;
      const targetOrder = targetSubtopic.displayOrder;

      // Optimistically update UI
      setTopics((prev) =>
        prev.map((t) =>
          t.id === effectiveSelectedTopicId
            ? {
                ...t,
                subtopics: t.subtopics.map((s) => {
                  if (s.id === subtopic.id) return { ...s, displayOrder: targetOrder };
                  if (s.id === targetSubtopic.id) return { ...s, displayOrder: currentOrder };
                  return s;
                }),
              }
            : t
        )
      );

      try {
        // Update both subtopics in parallel
        const [res1, res2] = await Promise.all([
          fetch(`/api/subtopics/${subtopic.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayOrder: targetOrder }),
          }),
          fetch(`/api/subtopics/${targetSubtopic.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayOrder: currentOrder }),
          }),
        ]);

        if (!res1.ok || !res2.ok) {
          // Revert on failure
          setTopics((prev) =>
            prev.map((t) =>
              t.id === effectiveSelectedTopicId
                ? {
                    ...t,
                    subtopics: t.subtopics.map((s) => {
                      if (s.id === subtopic.id) return { ...s, displayOrder: currentOrder };
                      if (s.id === targetSubtopic.id) return { ...s, displayOrder: targetOrder };
                      return s;
                    }),
                  }
                : t
            )
          );
          setError("Failed to reorder subtopic");
        }
      } catch {
        // Revert on failure
        setTopics((prev) =>
          prev.map((t) =>
            t.id === effectiveSelectedTopicId
              ? {
                  ...t,
                  subtopics: t.subtopics.map((s) => {
                    if (s.id === subtopic.id) return { ...s, displayOrder: currentOrder };
                    if (s.id === targetSubtopic.id) return { ...s, displayOrder: targetOrder };
                    return s;
                  }),
                }
              : t
          )
        );
        setError("Failed to reorder subtopic");
      }
    },
    [selectedTopic, effectiveSelectedTopicId]
  );

  // Separate active and inactive for both panels, sorted by displayOrder
  const activeTopics = topics
    .filter((t) => t.status === "ACTIVE")
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const inactiveTopics = topics
    .filter((t) => t.status === "INACTIVE")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const activeSubtopics = (
    selectedTopic?.subtopics.filter((s) => s.status === "ACTIVE") || []
  ).sort((a, b) => a.displayOrder - b.displayOrder);
  const inactiveSubtopics = (
    selectedTopic?.subtopics.filter((s) => s.status === "INACTIVE") || []
  ).sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
            Topics
          </h1>
          <p className="text-[var(--text-muted)] text-[13px] mt-0.5">
            Manage timesheet entry categories and subtopics
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-sm">
          {error}
        </div>
      )}

      {/* Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Panel: Topics */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
          {/* Topics Header */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h3 className="font-medium text-sm text-[var(--text-primary)]">
              Topics ({activeTopics.length} active)
            </h3>
            <button
              onClick={openCreateTopic}
              className="
                px-3 py-1.5 rounded text-xs font-medium
                bg-[var(--accent-pink)] text-[var(--bg-deep)]
                hover:bg-[var(--accent-pink-dim)]
                transition-all duration-200
              "
            >
              Add Topic
            </button>
          </div>

          {/* Active Topics List */}
          {activeTopics.length === 0 && inactiveTopics.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] text-sm">
              No topics yet. Create one to get started.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {activeTopics.map((topic, index) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  isSelected={topic.id === effectiveSelectedTopicId}
                  onSelect={() => setSelectedTopicId(topic.id)}
                  onEdit={() => openEditTopic(topic)}
                  onToggleStatus={() => toggleTopicStatus(topic)}
                  onDelete={() => deleteTopic(topic)}
                  onMoveUp={() => moveTopicInDirection(topic, "up")}
                  onMoveDown={() => moveTopicInDirection(topic, "down")}
                  isFirst={index === 0}
                  isLast={index === activeTopics.length - 1}
                />
              ))}

              {/* Inactive Topics */}
              {inactiveTopics.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs font-medium">
                    Inactive ({inactiveTopics.length})
                  </div>
                  {inactiveTopics.map((topic, index) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      isSelected={topic.id === effectiveSelectedTopicId}
                      onSelect={() => setSelectedTopicId(topic.id)}
                      onEdit={() => openEditTopic(topic)}
                      onToggleStatus={() => toggleTopicStatus(topic)}
                      onDelete={() => deleteTopic(topic)}
                      onMoveUp={() => moveTopicInDirection(topic, "up")}
                      onMoveDown={() => moveTopicInDirection(topic, "down")}
                      isFirst={index === 0}
                      isLast={index === inactiveTopics.length - 1}
                      isInactive
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Subtopics */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
          {/* Subtopics Header */}
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sm text-[var(--text-primary)]">
                Subtopics
              </h3>
              {selectedTopic && (
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  for {selectedTopic.name}
                </p>
              )}
            </div>
            {selectedTopic && (
              <button
                onClick={openCreateSubtopic}
                className="
                  px-3 py-1.5 rounded text-xs font-medium
                  bg-[var(--accent-pink)] text-[var(--bg-deep)]
                  hover:bg-[var(--accent-pink-dim)]
                  transition-all duration-200
                "
              >
                Add Subtopic
              </button>
            )}
          </div>

          {/* Subtopics Content */}
          {!selectedTopic ? (
            <div className="p-8 text-center text-[var(--text-muted)] text-sm">
              Select a topic to view its subtopics
            </div>
          ) : activeSubtopics.length === 0 && inactiveSubtopics.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] text-sm">
              No subtopics yet. Create one for this topic.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {activeSubtopics.map((subtopic, index) => (
                <SubtopicRow
                  key={subtopic.id}
                  subtopic={subtopic}
                  onEdit={() => openEditSubtopic(subtopic)}
                  onToggleStatus={() => toggleSubtopicStatus(subtopic)}
                  onDelete={() => deleteSubtopic(subtopic)}
                  onMoveUp={() => moveSubtopicInDirection(subtopic, "up")}
                  onMoveDown={() => moveSubtopicInDirection(subtopic, "down")}
                  isFirst={index === 0}
                  isLast={index === activeSubtopics.length - 1}
                />
              ))}

              {/* Inactive Subtopics */}
              {inactiveSubtopics.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs font-medium">
                    Inactive ({inactiveSubtopics.length})
                  </div>
                  {inactiveSubtopics.map((subtopic, index) => (
                    <SubtopicRow
                      key={subtopic.id}
                      subtopic={subtopic}
                      onEdit={() => openEditSubtopic(subtopic)}
                      onToggleStatus={() => toggleSubtopicStatus(subtopic)}
                      onDelete={() => deleteSubtopic(subtopic)}
                      onMoveUp={() => moveSubtopicInDirection(subtopic, "up")}
                      onMoveDown={() => moveSubtopicInDirection(subtopic, "down")}
                      isFirst={index === 0}
                      isLast={index === inactiveSubtopics.length - 1}
                      isInactive
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showTopicModal && (
        <TopicModal
          topic={editingTopic}
          onSave={handleSaveTopic}
          onClose={closeTopicModal}
        />
      )}

      {showSubtopicModal && (
        <SubtopicModal
          subtopic={editingSubtopic}
          onSave={handleSaveSubtopic}
          onClose={closeSubtopicModal}
        />
      )}
    </div>
  );
}

// Topic row component
interface TopicRowProps {
  topic: Topic;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  isInactive?: boolean;
}

function TopicRow({
  topic,
  isSelected,
  onSelect,
  onEdit,
  onToggleStatus,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isInactive,
}: TopicRowProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        p-3 flex items-center justify-between cursor-pointer transition-colors
        ${isSelected ? "bg-[var(--accent-pink-glow)] border-l-2 border-l-[var(--accent-pink)]" : "hover:bg-[var(--bg-hover)]"}
        ${isInactive ? "opacity-60" : ""}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`font-medium text-sm truncate ${isInactive ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
        >
          {topic.name}
        </span>
        <span className="text-[var(--text-muted)] text-xs shrink-0">
          ({topic.subtopics.length})
        </span>
      </div>
      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={`p-1.5 text-xs transition-colors ${
            isFirst
              ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          title="Move up"
        >
          <ChevronUpIcon />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={`p-1.5 text-xs transition-colors ${
            isLast
              ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          title="Move down"
        >
          <ChevronDownIcon />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Edit"
        >
          <EditIcon />
        </button>
        <button
          onClick={onToggleStatus}
          className={`p-1.5 text-xs transition-colors ${
            isInactive
              ? "text-[var(--success)] hover:text-[var(--success)]"
              : "text-[var(--text-muted)] hover:text-[var(--warning)]"
          }`}
          title={isInactive ? "Reactivate" : "Deactivate"}
        >
          {isInactive ? <ActivateIcon /> : <DeactivateIcon />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          title="Delete"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
}

// Subtopic row component
interface SubtopicRowProps {
  subtopic: Subtopic;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  isInactive?: boolean;
}

function SubtopicRow({
  subtopic,
  onEdit,
  onToggleStatus,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isInactive,
}: SubtopicRowProps) {
  return (
    <div
      className={`
        p-3 flex items-center justify-between transition-colors hover:bg-[var(--bg-hover)]
        ${isInactive ? "opacity-60" : ""}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`text-sm truncate ${isInactive ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
        >
          {subtopic.name}
        </span>
        {subtopic.isPrefix && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--info-bg)] text-[var(--info)] rounded">
            prefix
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={`p-1.5 text-xs transition-colors ${
            isFirst
              ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          title="Move up"
        >
          <ChevronUpIcon />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={`p-1.5 text-xs transition-colors ${
            isLast
              ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          title="Move down"
        >
          <ChevronDownIcon />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Edit"
        >
          <EditIcon />
        </button>
        <button
          onClick={onToggleStatus}
          className={`p-1.5 text-xs transition-colors ${
            isInactive
              ? "text-[var(--success)] hover:text-[var(--success)]"
              : "text-[var(--text-muted)] hover:text-[var(--warning)]"
          }`}
          title={isInactive ? "Reactivate" : "Deactivate"}
        >
          {isInactive ? <ActivateIcon /> : <DeactivateIcon />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          title="Delete"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
}

// Icons
function ChevronUpIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function DeactivateIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
      />
    </svg>
  );
}

function ActivateIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
