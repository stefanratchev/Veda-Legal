import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { createRef } from "react";
import { TopicCascadeSelect, TopicCascadeSelectRef } from "./TopicCascadeSelect";
import type { Topic, Subtopic } from "@/types";

// Mock the useClickOutside hook
vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

// Mock scrollIntoView since it's not available in JSDOM
Element.prototype.scrollIntoView = vi.fn();

describe("TopicCascadeSelect", () => {
  const mockOnChange = vi.fn();

  const mockSubtopics1: Subtopic[] = [
    {
      id: "sub1",
      name: "Client correspondence:",
      isPrefix: true,
      displayOrder: 1,
      status: "ACTIVE",
    },
    {
      id: "sub2",
      name: "Drafting documents",
      isPrefix: false,
      displayOrder: 2,
      status: "ACTIVE",
    },
    {
      id: "sub3",
      name: "Legal research",
      isPrefix: false,
      displayOrder: 3,
      status: "ACTIVE",
    },
  ];

  const mockSubtopics2: Subtopic[] = [
    {
      id: "sub4",
      name: "Due diligence",
      isPrefix: false,
      displayOrder: 1,
      status: "ACTIVE",
    },
    {
      id: "sub5",
      name: "Contract review:",
      isPrefix: true,
      displayOrder: 2,
      status: "ACTIVE",
    },
  ];

  const mockTopics: Topic[] = [
    {
      id: "topic1",
      name: "Company Incorporation",
      displayOrder: 1,
      status: "ACTIVE",
      topicType: "REGULAR",
      subtopics: mockSubtopics1,
    },
    {
      id: "topic2",
      name: "M&A Advisory",
      displayOrder: 2,
      status: "ACTIVE",
      topicType: "REGULAR",
      subtopics: mockSubtopics2,
    },
    {
      id: "topic3",
      name: "Litigation",
      displayOrder: 3,
      status: "ACTIVE",
      topicType: "REGULAR",
      subtopics: [],
    },
  ];

  const defaultProps = {
    topics: mockTopics,
    value: "",
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders with placeholder when no value", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      expect(screen.getByText("Select topic...")).toBeInTheDocument();
    });

    it("renders with custom placeholder when provided", () => {
      render(
        <TopicCascadeSelect {...defaultProps} placeholder="Choose topic" />
      );

      expect(screen.getByText("Choose topic")).toBeInTheDocument();
    });

    it("displays selected topic > subtopic when value is set", () => {
      render(<TopicCascadeSelect {...defaultProps} value="sub2" />);

      expect(
        screen.getByText("Company Incorporation > Drafting documents")
      ).toBeInTheDocument();
    });

    it("renders disabled state correctly", () => {
      render(<TopicCascadeSelect {...defaultProps} disabled />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Dropdown Behavior", () => {
    it("opens dropdown on click", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Search input should be visible when dropdown is open
      expect(
        screen.getByPlaceholderText("Search topics...")
      ).toBeInTheDocument();
    });

    it("shows topic list first when opened", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      // All topics should be visible
      expect(screen.getByText("Company Incorporation")).toBeInTheDocument();
      expect(screen.getByText("M&A Advisory")).toBeInTheDocument();
      expect(screen.getByText("Litigation")).toBeInTheDocument();

      // Shows subtopic count for each topic
      expect(screen.getByText("3")).toBeInTheDocument(); // Company Incorporation has 3
      expect(screen.getByText("2")).toBeInTheDocument(); // M&A Advisory has 2
      expect(screen.getByText("0")).toBeInTheDocument(); // Litigation has 0
    });

    it("closes dropdown on second click", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(
        screen.getByPlaceholderText("Search topics...")
      ).toBeInTheDocument();

      fireEvent.click(button);

      expect(
        screen.queryByPlaceholderText("Search topics...")
      ).not.toBeInTheDocument();
    });

    it("does not open dropdown when disabled", () => {
      render(<TopicCascadeSelect {...defaultProps} disabled />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(
        screen.queryByPlaceholderText("Search topics...")
      ).not.toBeInTheDocument();
    });
  });

  describe("Topic Navigation", () => {
    it("shows subtopics when topic is clicked", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      // Header should show topic name
      expect(screen.getByText("Company Incorporation")).toBeInTheDocument();

      // Subtopics should be visible
      expect(screen.getByText("Client correspondence:")).toBeInTheDocument();
      expect(screen.getByText("Drafting documents")).toBeInTheDocument();
      expect(screen.getByText("Legal research")).toBeInTheDocument();

      // Search placeholder should change
      expect(
        screen.getByPlaceholderText("Search subtopics...")
      ).toBeInTheDocument();
    });

    it("back button returns to topics", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      // Now in subtopic view - find the back button (second button in the DOM)
      // First button is the main trigger, second is the back button in the header
      const buttons = screen.getAllByRole("button");
      const backButton = buttons[1]; // The back button in the dropdown header
      fireEvent.click(backButton);

      // Should be back in topic view
      expect(screen.getByText("M&A Advisory")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search topics...")
      ).toBeInTheDocument();
    });
  });

  describe("Subtopic Selection", () => {
    it("selects subtopic and calls onChange with correct arguments", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));
      fireEvent.click(screen.getByText("Drafting documents"));

      expect(mockOnChange).toHaveBeenCalledWith(
        "sub2",
        mockSubtopics1[1],
        mockTopics[0]
      );
      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it("closes dropdown after selection", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));
      fireEvent.click(screen.getByText("Drafting documents"));

      expect(
        screen.queryByPlaceholderText("Search subtopics...")
      ).not.toBeInTheDocument();
    });

    it("handles isPrefix subtopics with +details indicator", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      // isPrefix subtopic should have +details badge
      expect(screen.getByText("+details")).toBeInTheDocument();
    });
  });

  describe("Filtering", () => {
    it("filters topics as user types", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search topics...");
      fireEvent.change(searchInput, { target: { value: "M&A" } });

      expect(screen.getByText("M&A Advisory")).toBeInTheDocument();
      expect(
        screen.queryByText("Company Incorporation")
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Litigation")).not.toBeInTheDocument();
    });

    it("filters subtopics when in subtopic view", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      const searchInput = screen.getByPlaceholderText("Search subtopics...");
      fireEvent.change(searchInput, { target: { value: "draft" } });

      expect(screen.getByText("Drafting documents")).toBeInTheDocument();
      expect(
        screen.queryByText("Client correspondence:")
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Legal research")).not.toBeInTheDocument();
    });

    it("shows empty state when no topics match", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search topics...");
      fireEvent.change(searchInput, { target: { value: "XYZ Nonexistent" } });

      expect(screen.getByText("No topics found")).toBeInTheDocument();
    });

    it("shows empty state when no subtopics match", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      const searchInput = screen.getByPlaceholderText("Search subtopics...");
      fireEvent.change(searchInput, { target: { value: "XYZ Nonexistent" } });

      expect(screen.getByText("No subtopics found")).toBeInTheDocument();
    });

    it("clears search when navigating to subtopics", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search topics...");
      fireEvent.change(searchInput, { target: { value: "Company" } });

      fireEvent.click(screen.getByText("Company Incorporation"));

      // Search input should be cleared in subtopic view
      const subtopicSearchInput = screen.getByPlaceholderText(
        "Search subtopics..."
      );
      expect(subtopicSearchInput).toHaveValue("");
    });
  });

  describe("Keyboard Navigation", () => {
    it("closes dropdown on Escape key when in topic view", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search topics...");
      fireEvent.keyDown(searchInput, { key: "Escape" });

      expect(
        screen.queryByPlaceholderText("Search topics...")
      ).not.toBeInTheDocument();
    });

    it("goes back to topics on Escape key when in subtopic view", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      const searchInput = screen.getByPlaceholderText("Search subtopics...");
      fireEvent.keyDown(searchInput, { key: "Escape" });

      // Should be back in topic view
      expect(
        screen.getByPlaceholderText("Search topics...")
      ).toBeInTheDocument();
    });

    it("navigates with arrow keys and selects topic with Enter", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search topics...");

      // Navigate down to second topic (M&A Advisory)
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });

      // Press Enter to drill into the topic
      fireEvent.keyDown(searchInput, { key: "Enter" });

      // Should now be in M&A Advisory subtopics view
      expect(
        screen.getByPlaceholderText("Search subtopics...")
      ).toBeInTheDocument();
      expect(screen.getByText("Due diligence")).toBeInTheDocument();
    });

    it("navigates with arrow keys and selects subtopic with Enter", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      const searchInput = screen.getByPlaceholderText("Search subtopics...");

      // Navigate down to second subtopic
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });

      // Press Enter to select
      fireEvent.keyDown(searchInput, { key: "Enter" });

      expect(mockOnChange).toHaveBeenCalledWith(
        "sub2",
        mockSubtopics1[1],
        mockTopics[0]
      );
    });

    it("navigates up with ArrowUp key", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      const searchInput = screen.getByPlaceholderText("Search subtopics...");

      // Navigate down twice, then up once
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowDown" });
      fireEvent.keyDown(searchInput, { key: "ArrowUp" });

      // Press Enter to select (should be back at index 1)
      fireEvent.keyDown(searchInput, { key: "Enter" });

      expect(mockOnChange).toHaveBeenCalledWith(
        "sub2",
        mockSubtopics1[1],
        mockTopics[0]
      );
    });

    it("ArrowRight drills into topic from topic view", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));

      const searchInput = screen.getByPlaceholderText("Search topics...");

      // Press ArrowRight to drill into first topic
      fireEvent.keyDown(searchInput, { key: "ArrowRight" });

      // Should now be in Company Incorporation subtopics view
      expect(
        screen.getByPlaceholderText("Search subtopics...")
      ).toBeInTheDocument();
      expect(screen.getByText("Client correspondence:")).toBeInTheDocument();
    });

    it("ArrowLeft goes back to topics from subtopic view", () => {
      render(<TopicCascadeSelect {...defaultProps} />);

      fireEvent.click(screen.getByRole("button"));
      fireEvent.click(screen.getByText("Company Incorporation"));

      const searchInput = screen.getByPlaceholderText("Search subtopics...");

      // Press ArrowLeft to go back
      fireEvent.keyDown(searchInput, { key: "ArrowLeft" });

      // Should be back in topic view
      expect(
        screen.getByPlaceholderText("Search topics...")
      ).toBeInTheDocument();
    });
  });

  describe("Empty Topic List", () => {
    it("shows empty state when topics array is empty", () => {
      render(<TopicCascadeSelect {...defaultProps} topics={[]} />);

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByText("No topics found")).toBeInTheDocument();
    });
  });

  describe("Imperative Handle", () => {
    it("exposes open() method via ref", () => {
      const ref = createRef<TopicCascadeSelectRef>();

      render(<TopicCascadeSelect {...defaultProps} ref={ref} />);

      // Call open() imperatively (wrapped in act since it causes state updates)
      act(() => {
        ref.current?.open();
      });

      // Dropdown should be open
      expect(
        screen.getByPlaceholderText("Search topics...")
      ).toBeInTheDocument();
    });

    it("open() does nothing when disabled", () => {
      const ref = createRef<TopicCascadeSelectRef>();

      render(<TopicCascadeSelect {...defaultProps} disabled ref={ref} />);

      // Call open() imperatively (wrapped in act for consistency)
      act(() => {
        ref.current?.open();
      });

      // Dropdown should remain closed
      expect(
        screen.queryByPlaceholderText("Search topics...")
      ).not.toBeInTheDocument();
    });
  });
});
