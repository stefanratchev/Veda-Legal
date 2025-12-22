"use client";

import { useState, useCallback } from "react";
import { TopicModal } from "./TopicModal";

interface Topic {
  id: string;
  name: string;
  code: string;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

interface TopicsContentProps {
  initialTopics: Topic[];
}

export function TopicsContent({ initialTopics }: TopicsContentProps) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setEditingTopic(null);
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((topic: Topic) => {
    setEditingTopic(topic);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTopic(null);
  }, []);

  const handleSave = useCallback(async (data: { name: string; code: string }) => {
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
      }

      closeModal();
    } catch {
      setError("Failed to save topic");
    }
  }, [editingTopic, closeModal]);

  const toggleStatus = useCallback(async (topic: Topic) => {
    const newStatus = topic.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      const response = await fetch(`/api/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (response.ok) {
        setTopics((prev) =>
          prev.map((t) => (t.id === topic.id ? result : t))
        );
      }
    } catch {
      console.error("Failed to toggle status");
    }
  }, []);

  const activeTopics = topics.filter((t) => t.status === "ACTIVE");
  const inactiveTopics = topics.filter((t) => t.status === "INACTIVE");

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
            Topics
          </h1>
          <p className="text-[var(--text-muted)] text-[13px] mt-0.5">
            Manage timesheet entry categories
          </p>
        </div>
        <button
          onClick={openCreate}
          className="
            px-4 py-2 rounded
            bg-[var(--accent-pink)] text-[var(--bg-deep)]
            font-semibold text-sm
            hover:bg-[var(--accent-pink-dim)]
            transition-all duration-200
            shadow-lg shadow-[var(--accent-pink-glow)]
          "
        >
          Add Topic
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-sm">
          {error}
        </div>
      )}

      {/* Active Topics */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="font-medium text-sm text-[var(--text-primary)]">
            Active Topics ({activeTopics.length})
          </h3>
        </div>
        {activeTopics.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-sm">
            No active topics
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {activeTopics.map((topic) => (
              <div
                key={topic.id}
                className="p-4 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[var(--accent-pink)] font-mono text-xs bg-[var(--accent-pink-glow)] px-2 py-1 rounded">
                    {topic.code}
                  </span>
                  <span className="text-[var(--text-primary)] font-medium">
                    {topic.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(topic)}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-accent)] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(topic)}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--warning)] bg-[var(--warning-bg)] rounded hover:opacity-80 transition-opacity"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Topics */}
      {inactiveTopics.length > 0 && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h3 className="font-medium text-sm text-[var(--text-muted)]">
              Inactive Topics ({inactiveTopics.length})
            </h3>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {inactiveTopics.map((topic) => (
              <div
                key={topic.id}
                className="p-4 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[var(--text-muted)] font-mono text-xs bg-[var(--bg-surface)] px-2 py-1 rounded">
                    {topic.code}
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {topic.name}
                  </span>
                </div>
                <button
                  onClick={() => toggleStatus(topic)}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--success)] bg-[var(--success-bg)] rounded hover:opacity-80 transition-opacity"
                >
                  Reactivate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <TopicModal
          topic={editingTopic}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
