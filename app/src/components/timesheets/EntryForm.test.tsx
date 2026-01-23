import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EntryForm } from "./EntryForm";
import type { ClientWithType, Topic, FormData } from "@/types";

// Mock child components
vi.mock("@/components/ui/ClientSelect", () => ({
  ClientSelect: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    clients: ClientWithType[];
    value: string;
    onChange: (id: string) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <button
      data-testid="client-select"
      data-value={value}
      className={className}
      onClick={() => onChange("client-1")}
    >
      {value || placeholder || "Select client..."}
    </button>
  ),
}));

vi.mock("@/components/ui/TopicCascadeSelect", () => ({
  TopicCascadeSelect: vi.fn().mockImplementation(
    ({
      value,
      onChange,
      placeholder,
      className,
    }: {
      topics: Topic[];
      value: string;
      onChange: (id: string, subtopic: { id: string; name: string; isPrefix: boolean } | null, topic: Topic) => void;
      placeholder?: string;
      className?: string;
    }) => (
      <button
        data-testid="topic-cascade-select"
        data-value={value}
        className={className}
        onClick={() =>
          onChange(
            "subtopic-1",
            {
              id: "subtopic-1",
              name: "Client correspondence:",
              isPrefix: true,
            },
            {
              id: "topic-1",
              name: "M&A Advisory",
              displayOrder: 1,
              status: "ACTIVE",
              topicType: "REGULAR",
              subtopics: [],
            }
          )
        }
      >
        {value || placeholder || "Select topic..."}
      </button>
    )
  ),
}));

vi.mock("@/components/ui/DurationPicker", () => ({
  DurationPicker: vi.fn().mockImplementation(
    ({
      hours,
      minutes,
      onChange,
      className,
    }: {
      hours: number;
      minutes: number;
      onChange: (hours: number, minutes: number) => void;
      className?: string;
    }) => (
      <button
        data-testid="duration-picker"
        data-hours={hours}
        data-minutes={minutes}
        className={className}
        onClick={() => onChange(2, 30)}
      >
        {hours}h {minutes}m
      </button>
    )
  ),
}));

describe("EntryForm", () => {
  const mockOnFormChange = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const mockClients: ClientWithType[] = [
    { id: "client-1", name: "Acme Corporation", clientType: "REGULAR" },
    { id: "client-2", name: "Beta Industries", clientType: "REGULAR" },
  ];

  const mockTopics: Topic[] = [
    {
      id: "topic-1",
      name: "M&A Advisory",
      displayOrder: 1,
      status: "ACTIVE",
      topicType: "REGULAR",
      subtopics: [
        {
          id: "subtopic-1",
          name: "Client correspondence:",
          isPrefix: true,
          displayOrder: 1,
          status: "ACTIVE",
        },
        {
          id: "subtopic-2",
          name: "Drafting documents",
          isPrefix: false,
          displayOrder: 2,
          status: "ACTIVE",
        },
      ],
    },
  ];

  const defaultFormData: FormData = {
    clientId: "",
    topicId: "",
    subtopicId: "",
    hours: 1,
    minutes: 0,
    description: "",
  };

  const defaultProps = {
    clients: mockClients,
    topics: mockTopics,
    formData: defaultFormData,
    isLoading: false,
    error: null,
    onFormChange: mockOnFormChange,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders all form fields", () => {
      render(<EntryForm {...defaultProps} />);

      expect(screen.getByTestId("client-select")).toBeInTheDocument();
      expect(screen.getByTestId("topic-cascade-select")).toBeInTheDocument();
      expect(screen.getByTestId("duration-picker")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("What did you work on?")
      ).toBeInTheDocument();
    });

    it("renders submit button with 'Log' text in create mode", () => {
      render(<EntryForm {...defaultProps} />);

      // Both mobile and desktop buttons exist
      const logButtons = screen.getAllByRole("button", { name: "Log" });
      expect(logButtons.length).toBeGreaterThan(0);
    });

    it("renders submit button with 'Save' text in edit mode", () => {
      render(<EntryForm {...defaultProps} isEditMode onCancel={mockOnCancel} />);

      const saveButtons = screen.getAllByRole("button", { name: "Save" });
      expect(saveButtons.length).toBeGreaterThan(0);
    });

    it("renders cancel button in edit mode", () => {
      render(<EntryForm {...defaultProps} isEditMode onCancel={mockOnCancel} />);

      const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
      expect(cancelButtons.length).toBeGreaterThan(0);
    });

    it("does not render cancel button when not in edit mode", () => {
      render(<EntryForm {...defaultProps} />);

      expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    });
  });

  describe("Form Data Display", () => {
    it("displays current form data in fields", () => {
      const populatedFormData: FormData = {
        clientId: "client-1",
        topicId: "",
        subtopicId: "subtopic-1",
        hours: 2,
        minutes: 30,
        description: "Working on contract review",
      };

      render(<EntryForm {...defaultProps} formData={populatedFormData} />);

      expect(screen.getByTestId("client-select")).toHaveAttribute(
        "data-value",
        "client-1"
      );
      expect(screen.getByTestId("topic-cascade-select")).toHaveAttribute(
        "data-value",
        "subtopic-1"
      );
      expect(screen.getByTestId("duration-picker")).toHaveAttribute(
        "data-hours",
        "2"
      );
      expect(screen.getByTestId("duration-picker")).toHaveAttribute(
        "data-minutes",
        "30"
      );
      expect(screen.getByDisplayValue("Working on contract review")).toBeInTheDocument();
    });

    it("edit mode populates existing values correctly", () => {
      const editFormData: FormData = {
        clientId: "client-2",
        topicId: "",
        subtopicId: "subtopic-2",
        hours: 3,
        minutes: 15,
        description: "Existing work description",
      };

      render(
        <EntryForm
          {...defaultProps}
          formData={editFormData}
          isEditMode
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue("Existing work description")).toBeInTheDocument();
      expect(screen.getByTestId("duration-picker")).toHaveAttribute("data-hours", "3");
      expect(screen.getByTestId("duration-picker")).toHaveAttribute("data-minutes", "15");
    });
  });

  describe("Form Interactions", () => {
    it("calls onFormChange when client is selected", () => {
      render(<EntryForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId("client-select"));

      // When client changes, it clears topic selection since filtered topics change
      expect(mockOnFormChange).toHaveBeenCalledWith({
        clientId: "client-1",
        topicId: "",
        subtopicId: "",
        description: "",
      });
    });

    it("calls onFormChange when subtopic is selected", () => {
      render(<EntryForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId("topic-cascade-select"));

      expect(mockOnFormChange).toHaveBeenCalledWith({
        subtopicId: "subtopic-1",
        topicId: "",
        description: "Client correspondence: ",
      });
    });

    it("calls onFormChange when duration is changed", () => {
      render(<EntryForm {...defaultProps} />);

      fireEvent.click(screen.getByTestId("duration-picker"));

      expect(mockOnFormChange).toHaveBeenCalledWith({ hours: 2, minutes: 30 });
    });

    it("calls onFormChange when description is typed", () => {
      render(<EntryForm {...defaultProps} />);

      const descriptionInput = screen.getByPlaceholderText("What did you work on?");
      fireEvent.change(descriptionInput, { target: { value: "New description" } });

      expect(mockOnFormChange).toHaveBeenCalledWith({ description: "New description" });
    });
  });

  describe("Submit Behavior", () => {
    it("submit button is disabled when form is incomplete", () => {
      render(<EntryForm {...defaultProps} />);

      const submitButtons = screen.getAllByRole("button", { name: "Log" });
      submitButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("submit button is enabled when form is complete", () => {
      const completeFormData: FormData = {
        clientId: "client-1",
        topicId: "",
        subtopicId: "subtopic-1",
        hours: 1,
        minutes: 0,
        description: "Work done",
      };

      render(<EntryForm {...defaultProps} formData={completeFormData} />);

      const submitButtons = screen.getAllByRole("button", { name: "Log" });
      submitButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });
    });

    it("submit button is enabled with just minutes (no hours)", () => {
      const minutesOnlyFormData: FormData = {
        clientId: "client-1",
        topicId: "",
        subtopicId: "subtopic-1",
        hours: 0,
        minutes: 30,
        description: "Quick task",
      };

      render(<EntryForm {...defaultProps} formData={minutesOnlyFormData} />);

      const submitButtons = screen.getAllByRole("button", { name: "Log" });
      submitButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });
    });

    it("calls onSubmit when submit button is clicked", () => {
      const completeFormData: FormData = {
        clientId: "client-1",
        topicId: "",
        subtopicId: "subtopic-1",
        hours: 1,
        minutes: 0,
        description: "Work done",
      };

      render(<EntryForm {...defaultProps} formData={completeFormData} />);

      const submitButtons = screen.getAllByRole("button", { name: "Log" });
      fireEvent.click(submitButtons[0]);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it("calls onSubmit on Enter key in description field when form is complete", () => {
      const completeFormData: FormData = {
        clientId: "client-1",
        topicId: "",
        subtopicId: "subtopic-1",
        hours: 1,
        minutes: 0,
        description: "Work done",
      };

      render(<EntryForm {...defaultProps} formData={completeFormData} />);

      const descriptionInput = screen.getByPlaceholderText("What did you work on?");
      fireEvent.keyDown(descriptionInput, { key: "Enter" });

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });

    it("does not call onSubmit on Enter when form is incomplete", () => {
      render(<EntryForm {...defaultProps} />);

      const descriptionInput = screen.getByPlaceholderText("What did you work on?");
      fireEvent.keyDown(descriptionInput, { key: "Enter" });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("shows loading indicator when isLoading is true", () => {
      const completeFormData: FormData = {
        clientId: "client-1",
        topicId: "",
        subtopicId: "subtopic-1",
        hours: 1,
        minutes: 0,
        description: "Work done",
      };

      render(<EntryForm {...defaultProps} formData={completeFormData} isLoading />);

      const loadingButtons = screen.getAllByRole("button", { name: "..." });
      expect(loadingButtons.length).toBeGreaterThan(0);
    });

    it("disables submit button when loading", () => {
      const completeFormData: FormData = {
        clientId: "client-1",
        topicId: "",
        subtopicId: "subtopic-1",
        hours: 1,
        minutes: 0,
        description: "Work done",
      };

      render(<EntryForm {...defaultProps} formData={completeFormData} isLoading />);

      const submitButtons = screen.getAllByRole("button", { name: "..." });
      submitButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("does not call onSubmit on Enter when loading", () => {
      const completeFormData: FormData = {
        clientId: "client-1",
        topicId: "",
        subtopicId: "subtopic-1",
        hours: 1,
        minutes: 0,
        description: "Work done",
      };

      render(<EntryForm {...defaultProps} formData={completeFormData} isLoading />);

      const descriptionInput = screen.getByPlaceholderText("What did you work on?");
      fireEvent.keyDown(descriptionInput, { key: "Enter" });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe("Error Display", () => {
    it("displays error message when error prop is provided", () => {
      render(<EntryForm {...defaultProps} error="Failed to create entry" />);

      expect(screen.getByText("Failed to create entry")).toBeInTheDocument();
    });

    it("does not display error message when error is null", () => {
      render(<EntryForm {...defaultProps} error={null} />);

      expect(screen.queryByText(/Failed/)).not.toBeInTheDocument();
    });

    it("error message has danger styling", () => {
      render(<EntryForm {...defaultProps} error="Something went wrong" />);

      const errorDiv = screen.getByText("Something went wrong");
      expect(errorDiv).toHaveClass("bg-[var(--danger-bg)]");
      expect(errorDiv).toHaveClass("text-[var(--danger)]");
    });
  });

  describe("Cancel Behavior", () => {
    it("calls onCancel when cancel button is clicked", () => {
      render(<EntryForm {...defaultProps} isEditMode onCancel={mockOnCancel} />);

      const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButtons[0]);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });
});
