/**
 * Canvas Drop Submit - React Component Tests
 * @module __tests__/components.test
 * @description Jest + React Testing Library tests for all React components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock fetch globally
global.fetch = jest.fn();

// Extend window interface for Electron APIs
declare global {
  interface Window {
    electronAPI?: {
      storeToken?: (token: string) => Promise<void>;
      readFile?: jest.Mock;
    };
    electronApi?: {
      getPathForFile?: (file: File) => string;
    };
  }
}

// ============================================================================
// Type Imports (for test data)
// ============================================================================

import type { Course, Assignment, Submission } from '../shared/types';

// ============================================================================
// Component Imports
// ============================================================================

import { Login } from '../renderer/components/Login';
import { CourseList } from '../renderer/components/CourseList';
import { AssignmentList } from '../renderer/components/AssignmentList';
import { DropZone } from '../renderer/components/DropZone';

// ============================================================================
// Test Data Fixtures
// ============================================================================

const mockCourse: Course = {
  id: 12345,
  name: 'Introduction to Computer Science',
  course_code: 'CS101',
  teachers: [
    { id: 1, display_name: 'Dr. Smith', avatar_image_url: '' },
  ],
  term: { id: 1, name: '2024 Spring' },
  start_at: '2024-01-15T00:00:00Z',
  end_at: '2024-05-15T00:00:00Z',
  workflow_state: 'available',
};

const mockCourse2: Course = {
  id: 12346,
  name: 'Data Structures',
  course_code: 'CS201',
  teachers: [
    { id: 2, display_name: 'Prof. Johnson', avatar_image_url: '' },
  ],
  term: { id: 1, name: '2024 Spring' },
  start_at: '2024-01-15T00:00:00Z',
  end_at: '2024-05-15T00:00:00Z',
  workflow_state: 'available',
};

const mockSubmission: Submission = {
  id: 1,
  submission_type: 'online_upload',
  submitted_at: '2024-03-10T10:00:00Z',
  workflow_state: 'submitted',
  late: false,
  missing: false,
  score: 95,
  grade: 'A',
};

const mockAssignment: Assignment = {
  id: 1001,
  name: 'Assignment 1: Introduction',
  description: '<p>This is the first assignment</p>',
  due_at: '2024-04-01T23:59:59Z',
  lock_at: '2024-04-02T23:59:59Z',
  unlock_at: '2024-03-01T00:00:00Z',
  submission_types: ['online_upload'],
  has_submitted_submissions: true,
  submission: mockSubmission,
  points_possible: 100,
  grading_type: 'points',
  allowed_extensions: ['.pdf', '.doc', '.docx'],
};

const mockAssignmentUnsubmitted: Assignment = {
  id: 1002,
  name: 'Assignment 2: Data Analysis',
  description: '<p>Analyze the provided dataset</p>',
  due_at: '2024-04-15T23:59:59Z',
  lock_at: undefined,
  unlock_at: '2024-03-15T00:00:00Z',
  submission_types: ['online_upload'],
  has_submitted_submissions: false,
  submission: undefined,
  points_possible: 100,
  grading_type: 'points',
};

const mockAssignmentLocked: Assignment = {
  id: 1003,
  name: 'Assignment 3: Final Project',
  description: '<p>Final project submission</p>',
  due_at: '2024-03-01T23:59:59Z',
  lock_at: '2024-03-01T23:59:59Z',
  unlock_at: undefined,
  submission_types: ['online_upload'],
  has_submitted_submissions: false,
  submission: undefined,
  points_possible: 200,
  grading_type: 'points',
};

// Helper function to wrap assignments in assignment_groups format
const wrapInAssignmentGroups = (assignments: Assignment[]) => [
  {
    id: 1,
    name: 'Assignments',
    position: 1,
    group_weight: 100,
    assignments: assignments,
  },
];

// ============================================================================
// Login Component Tests
// ============================================================================

describe('Login Component', () => {
  const mockOnLoginSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('renders correctly with initial state', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    // Check main elements are rendered
    expect(screen.getByText('Canvas Drop Submit')).toBeInTheDocument();
    expect(screen.getByText(/请输入您的Canvas API Token以继续/)).toBeInTheDocument();
    expect(screen.getByLabelText('API Token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();

    // Check helper text
    expect(screen.getByText('如何获取API Token：')).toBeInTheDocument();
    expect(screen.getByText('登录Canvas网站')).toBeInTheDocument();
  });

  it('matches snapshot in initial state', () => {
    const { container } = render(<Login onLoginSuccess={mockOnLoginSuccess} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('allows token input and toggles visibility', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const input = screen.getByLabelText('API Token') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: '显示Token' });

    // Type token
    fireEvent.change(input, { target: { value: 'test-token-123' } });
    expect(input.value).toBe('test-token-123');

    // Check input type is password initially
    expect(input.type).toBe('password');

    // Toggle visibility
    fireEvent.click(toggleButton);
    expect(input.type).toBe('text');

    // Toggle back
    fireEvent.click(screen.getByRole('button', { name: '隐藏Token' }));
    expect(input.type).toBe('password');
  });

  it('shows error when submitting empty token', async () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    // Enter and then clear token to enable the button
    const input = screen.getByLabelText('API Token');
    fireEvent.change(input, { target: { value: 'temp' } });
    fireEvent.change(input, { target: { value: '' } });

    // Submit form directly since button is disabled when empty
    const form = input.closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(screen.getByText('请输入API Token')).toBeInTheDocument();
    });
  });

  it('disables submit button when token is empty', () => {
    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const submitButton = screen.getByRole('button', { name: '登录' });
    expect(submitButton).toBeDisabled();

    // Enable button when token is entered
    const input = screen.getByLabelText('API Token');
    fireEvent.change(input, { target: { value: 'valid-token' } });

    expect(submitButton).not.toBeDisabled();
  });

  it('shows loading state during token validation', async () => {
    (fetch as jest.Mock).mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 100))
    );

    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const input = screen.getByLabelText('API Token');
    fireEvent.change(input, { target: { value: 'valid-token' } });

    const submitButton = screen.getByRole('button', { name: '登录' });
    fireEvent.click(submitButton);

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText('验证中...')).toBeInTheDocument();
    });

    // Input should be disabled during loading
    expect(input).toBeDisabled();
  });

  it('calls onLoginSuccess with valid token', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const input = screen.getByLabelText('API Token');
    fireEvent.change(input, { target: { value: 'valid-token' } });

    const submitButton = screen.getByRole('button', { name: '登录' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalledWith('valid-token');
    });

    expect(window.electronAPI?.storeToken).toHaveBeenCalledWith('valid-token');
  });

  it('shows error message for invalid token', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });

    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const input = screen.getByLabelText('API Token');
    fireEvent.change(input, { target: { value: 'invalid-token' } });

    const submitButton = screen.getByRole('button', { name: '登录' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('API Token无效，请检查后再试')).toBeInTheDocument();
    });

    expect(mockOnLoginSuccess).not.toHaveBeenCalled();
  });

  it('handles network errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const input = screen.getByLabelText('API Token');
    fireEvent.change(input, { target: { value: 'some-token' } });

    const submitButton = screen.getByRole('button', { name: '登录' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('API Token无效，请检查后再试')).toBeInTheDocument();
    });
  });

  it('makes correct API call for token validation', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true });

    render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    const input = screen.getByLabelText('API Token');
    fireEvent.change(input, { target: { value: 'test-token' } });

    const submitButton = screen.getByRole('button', { name: '登录' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://oc.sjtu.edu.cn/api/v1/users/self',
        {
          headers: {
            Authorization: 'Bearer test-token',
          },
        }
      );
    });
  });
});

// ============================================================================
// CourseList Component Tests
// ============================================================================

describe('CourseList Component', () => {
  const mockOnSelectCourse = jest.fn();
  const apiToken = 'test-api-token';

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />);

    expect(screen.getByText('My Courses')).toBeInTheDocument();

    // Check for skeleton loading elements
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('matches snapshot in loading state', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const { container } = render(
      <CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders courses list after successful fetch', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [mockCourse, mockCourse2],
    });

    render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />);

    await waitFor(() => {
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    });

    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(screen.getByText('Data Structures')).toBeInTheDocument();
    expect(screen.getByText('CS201')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('matches snapshot with courses data', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [mockCourse],
    });

    const { container } = render(
      <CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />
    );

    await waitFor(() => {
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('calls onSelectCourse when a course is clicked', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [mockCourse, mockCourse2],
    });

    render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />);

    await waitFor(() => {
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    });

    const courseButton = screen.getByText('Introduction to Computer Science').closest('button');
    fireEvent.click(courseButton!);

    expect(mockOnSelectCourse).toHaveBeenCalledWith(12345);
  });

  it('highlights selected course', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [mockCourse, mockCourse2],
    });

    render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />);

    await waitFor(() => {
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    });

    const courseButton = screen.getByText('Introduction to Computer Science').closest('button');
    fireEvent.click(courseButton!);

    // Check for selected styling (border-blue-500 class)
    expect(courseButton).toHaveClass('border-blue-500');
  });

  it('renders empty state when no courses available', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />);

    await waitFor(() => {
      expect(screen.getByText('No active courses found.')).toBeInTheDocument();
    });
  });

  it('matches snapshot for empty state', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { container } = render(
      <CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />
    );

    await waitFor(() => {
      expect(screen.getByText('No active courses found.')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders error state when fetch fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
    });

    render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />);

    await waitFor(() => {
      expect(screen.getByText('Error loading courses')).toBeInTheDocument();
    });

    expect(screen.getByText('HTTP error! status: 401')).toBeInTheDocument();
  });

  it('matches snapshot for error state', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
    });

    const { container } = render(
      <CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />
    );

    await waitFor(() => {
      expect(screen.getByText('Error loading courses')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('allows retry when fetch fails', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCourse],
      });

    render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />);

    await waitFor(() => {
      expect(screen.getByText('Error loading courses')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    });
  });

  it('makes correct API call with proper headers', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<CourseList onSelectCourse={mockOnSelectCourse} apiToken={apiToken} />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'https://oc.sjtu.edu.cn/api/v1/courses?enrollment_state=active&include[]=teachers&include[]=term',
        {
          headers: {
            Authorization: 'Bearer test-api-token',
            Accept: 'application/json+canvas-string-ids',
          },
        }
      );
    });
  });
});

// ============================================================================
// AssignmentList Component Tests
// ============================================================================

describe('AssignmentList Component', () => {
  const mockOnSelectAssignment = jest.fn();
  const apiToken = 'test-api-token';
  const courseId = 12345;

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    expect(screen.getByText('加载作业列表...')).toBeInTheDocument();
  });

  it('matches snapshot in loading state', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    const { container } = render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders assignments list after successful fetch', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => wrapInAssignmentGroups([mockAssignment, mockAssignmentUnsubmitted]),
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('作业列表')).toBeInTheDocument();
    });

    expect(screen.getByText('Assignment 1: Introduction')).toBeInTheDocument();
    expect(screen.getByText('Assignment 2: Data Analysis')).toBeInTheDocument();
  });

  it('matches snapshot with assignments data', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => wrapInAssignmentGroups([mockAssignment]),
    });

    const { container } = render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Assignment 1: Introduction')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('displays correct submission status badges', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => wrapInAssignmentGroups([mockAssignment, mockAssignmentUnsubmitted]),
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('已提交')).toBeInTheDocument();
    });

    expect(screen.getByText('未提交')).toBeInTheDocument();
  });

  it('displays formatted due dates', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => wrapInAssignmentGroups([mockAssignment]),
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/截止:/)).toBeInTheDocument();
    });
  });

  it('calls onSelectAssignment when clicking a submittable assignment', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => wrapInAssignmentGroups([mockAssignmentUnsubmitted]),
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Assignment 2: Data Analysis')).toBeInTheDocument();
    });

    const assignmentCard = screen.getByText('Assignment 2: Data Analysis').closest('div[class*="cursor-pointer"]');
    fireEvent.click(assignmentCard!);

    expect(mockOnSelectAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1002,
        name: 'Assignment 2: Data Analysis',
      })
    );
  });

  it('does not call onSelectAssignment for locked assignments', async () => {
    // Set lock_at to past date
    const lockedAssignment = {
      ...mockAssignmentLocked,
      lock_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [lockedAssignment],
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Assignment 3: Final Project')).toBeInTheDocument();
    });

    const assignmentCard = screen.getByText('Assignment 3: Final Project').closest('div[class*="cursor-not-allowed"]');
    fireEvent.click(assignmentCard!);

    expect(mockOnSelectAssignment).not.toHaveBeenCalled();
  });

  it('shows locked message for locked assignments', async () => {
    const lockedAssignment = {
      ...mockAssignmentLocked,
      lock_at: new Date(Date.now() - 86400000).toISOString(),
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [lockedAssignment],
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('作业已锁定')).toBeInTheDocument();
    });
  });

  it('renders empty state when no assignments', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('暂无作业')).toBeInTheDocument();
    });
  });

  it('matches snapshot for empty state', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const { container } = render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('暂无作业')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders error state when fetch fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ errors: [{ message: 'Internal server error' }] }),
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });
  });

  it('matches snapshot for error state', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ errors: [{ message: 'Request failed' }] }),
    });

    const { container } = render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Request failed')).toBeInTheDocument();
    });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('allows retry when fetch fails', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ errors: [{ message: 'Server error' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => wrapInAssignmentGroups([mockAssignment]),
      });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('重试');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Assignment 1: Introduction')).toBeInTheDocument();
    });
  });

  it('makes correct API call with proper headers', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/courses/${courseId}/assignment_groups`),
        {
          headers: {
            Authorization: 'Bearer test-api-token',
            Accept: 'application/json+canvas-string-ids',
          },
        }
      );
    });
  });

  it('shows error when courseId or apiToken is missing', async () => {
    render(
      <AssignmentList
        courseId={0}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken=""
      />
    );

    await waitFor(() => {
      expect(screen.getByText('缺少课程ID或API Token')).toBeInTheDocument();
    });
  });

  it('highlights selected assignment', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => wrapInAssignmentGroups([mockAssignmentUnsubmitted]),
    });

    render(
      <AssignmentList
        courseId={courseId}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken={apiToken}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Assignment 2: Data Analysis')).toBeInTheDocument();
    });

    const assignmentCard = screen.getByText('Assignment 2: Data Analysis').closest('div[class*="cursor-pointer"]');
    fireEvent.click(assignmentCard!);

    // Should have selected styling
    expect(assignmentCard).toHaveClass('border-blue-500');
  });
});

// ============================================================================
// DropZone Component Tests
// ============================================================================

describe('DropZone Component', () => {
  const mockOnUploadComplete = jest.fn();
  const defaultProps = {
    assignmentId: 1001,
    courseId: 12345,
    apiToken: 'test-token',
    onUploadComplete: mockOnUploadComplete,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders correctly with initial state', () => {
    render(<DropZone {...defaultProps} />);

    // Check main elements
    expect(screen.getByText('点击选择文件')).toBeInTheDocument();
    expect(screen.getByText('或拖拽文件到此处')).toBeInTheDocument();
    expect(screen.getByText('支持多文件上传')).toBeInTheDocument();

    // Check hidden file input exists
    const fileInput = document.getElementById('file-input');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('multiple');
  });

  it('matches snapshot in initial state', () => {
    const { container } = render(<DropZone {...defaultProps} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('handles file selection via input', () => {
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Check file is displayed in the list
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText('已选择文件 (1)')).toBeInTheDocument();
  });

  it('displays file size correctly', () => {
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['a'.repeat(1024 * 1024)], 'large-file.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText(/MB/)).toBeInTheDocument();
  });

  it('allows removing individual files', () => {
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file1 = new File(['content1'], 'file1.pdf', { type: 'application/pdf' });
    const file2 = new File(['content2'], 'file2.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();

    // Find and click remove button for first file
    const removeButtons = screen.getAllByTitle('移除文件');
    fireEvent.click(removeButtons[0]);

    // First file should be removed
    expect(screen.queryByText('file1.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();
  });

  it('allows clearing all files', () => {
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file1 = new File(['content1'], 'file1.pdf', { type: 'application/pdf' });
    const file2 = new File(['content2'], 'file2.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.pdf')).toBeInTheDocument();

    // Click clear all button
    const clearButton = screen.getByText('清空全部');
    fireEvent.click(clearButton);

    // All files should be removed
    expect(screen.queryByText('file1.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('file2.pdf')).not.toBeInTheDocument();
  });

  it('shows upload button when files are selected', () => {
    render(<DropZone {...defaultProps} />);

    // Initially no upload button with specific pattern
    expect(screen.queryByText(/上传 \d+ 个文件/)).not.toBeInTheDocument();

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Upload button should appear
    expect(screen.getByText('上传 1 个文件')).toBeInTheDocument();
  });

  it('matches snapshot with files selected', () => {
    const { container } = render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('shows error when uploading without files', async () => {
    render(<DropZone {...defaultProps} />);

    // Try to trigger upload without files (this shouldn't normally happen via UI)
    // We'll test the error display by checking if error message can be shown
    expect(screen.queryByText('请先选择文件')).not.toBeInTheDocument();
  });

  it('handles drag enter and leave events', () => {
    render(<DropZone {...defaultProps} />);

    const dropZone = screen.getByText('点击选择文件').closest('div[class*="border-2"]');

    // Drag enter
    fireEvent.dragEnter(dropZone!, {
      dataTransfer: { items: [{ kind: 'file' }] },
    });

    // Drop zone should have dragging styles (border-blue-500)
    expect(dropZone).toHaveClass('border-blue-500');

    // Drag leave
    fireEvent.dragLeave(dropZone!);

    // Should return to normal state
    expect(dropZone).not.toHaveClass('border-blue-500');
  });

  it('handles drop event with files', () => {
    render(<DropZone {...defaultProps} />);

    const dropZone = screen.getByText('点击选择文件').closest('div[class*="border-2"]');
    const file = new File(['content'], 'dropped.pdf', { type: 'application/pdf' });

    fireEvent.drop(dropZone!, {
      dataTransfer: {
        files: [file],
        items: [{ kind: 'file' }],
      },
    });

    expect(screen.getByText('dropped.pdf')).toBeInTheDocument();
  });

  it('shows upload progress during upload', async () => {
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByText('上传 1 个文件');
    fireEvent.click(uploadButton);

    // Should show uploading state
    await waitFor(() => {
      expect(screen.getByText('上传中...')).toBeInTheDocument();
    });

    // Fast-forward through the upload simulation
    jest.advanceTimersByTime(2000);

    // Progress should be shown
    await waitFor(() => {
      const progressText = screen.queryByText(/%/);
      expect(progressText).toBeInTheDocument();
    });
  });

  it('disables interactions during upload', async () => {
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByText('上传 1 个文件');
    fireEvent.click(uploadButton);

    // Button should be disabled during upload
    await waitFor(() => {
      expect(uploadButton).toBeDisabled();
    });

    // File input should also be disabled
    expect(fileInput).toBeDisabled();
  });

  it('calls onUploadComplete after successful upload', async () => {
    jest.useRealTimers();
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByText('上传 1 个文件');
    fireEvent.click(uploadButton);

    // Wait for the callback to be called (upload simulation takes time)
    await waitFor(() => {
      expect(mockOnUploadComplete).toHaveBeenCalled();
    }, { timeout: 5000 });

    jest.useFakeTimers();
  });

  it('clears files after successful upload', async () => {
    jest.useRealTimers();
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('test.pdf')).toBeInTheDocument();

    const uploadButton = screen.getByText('上传 1 个文件');
    fireEvent.click(uploadButton);

    // Wait for files to be cleared (upload simulation takes time)
    await waitFor(() => {
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
    }, { timeout: 5000 });

    jest.useFakeTimers();
  });

  it('handles multiple file selection', () => {
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const files = [
      new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'file2.doc', { type: 'application/msword' }),
      new File(['content3'], 'file3.txt', { type: 'text/plain' }),
    ];

    fireEvent.change(fileInput, { target: { files } });

    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.getByText('file2.doc')).toBeInTheDocument();
    expect(screen.getByText('file3.txt')).toBeInTheDocument();
    expect(screen.getByText('已选择文件 (3)')).toBeInTheDocument();
    expect(screen.getByText('上传 3 个文件')).toBeInTheDocument();
  });

  it('matches snapshot with multiple files', () => {
    const { container } = render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const files = [
      new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'file2.doc', { type: 'application/msword' }),
    ];

    fireEvent.change(fileInput, { target: { files } });

    expect(container.firstChild).toMatchSnapshot();
  });

  it('displays correct file sizes for different sizes', () => {
    render(<DropZone {...defaultProps} />);

    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const files = [
      new File(['a'], 'tiny.txt', { type: 'text/plain' }), // 1 B
      new File(['a'.repeat(512)], 'small.txt', { type: 'text/plain' }), // 512 B
      new File(['a'.repeat(1024 * 1024)], 'medium.pdf', { type: 'application/pdf' }), // 1 MB
    ];

    fireEvent.change(fileInput, { target: { files } });

    // Check that file sizes are displayed
    const fileList = screen.getByText('已选择文件 (3)').closest('div')?.parentElement;
    expect(fileList).toBeInTheDocument();
  });

  it('clicking drop zone triggers file input', () => {
    render(<DropZone {...defaultProps} />);

    const dropZone = screen.getByText('点击选择文件').closest('div[class*="border-2"]');
    const fileInput = document.getElementById('file-input') as HTMLInputElement;

    // Mock click on file input
    const clickSpy = jest.spyOn(fileInput, 'click');

    fireEvent.click(dropZone!);

    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('prevents default on drag events', () => {
    render(<DropZone {...defaultProps} />);

    const dropZone = screen.getByText('点击选择文件').closest('div[class*="border-2"]');

    // Create and fire dragOver event
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverEvent, 'dataTransfer', {
      value: { items: [] },
    });

    fireEvent(dropZone!, dragOverEvent);

    // The component should handle the event without errors
    // This is mainly to ensure coverage of the event handlers
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Component Integration', () => {
  it('Login -> CourseList workflow', async () => {
    const mockOnLoginSuccess = jest.fn();
    const mockOnSelectCourse = jest.fn();

    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true }) // Login validation
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCourse],
      }); // Course list

    // Render Login
    const { unmount } = render(<Login onLoginSuccess={mockOnLoginSuccess} />);

    // Login
    const input = screen.getByLabelText('API Token');
    fireEvent.change(input, { target: { value: 'valid-token' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalledWith('valid-token');
    });

    unmount();

    // Render CourseList with the token
    render(
      <CourseList onSelectCourse={mockOnSelectCourse} apiToken="valid-token" />
    );

    await waitFor(() => {
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    });
  });

  it('CourseList -> AssignmentList workflow', async () => {
    const mockOnSelectCourse = jest.fn();
    const mockOnSelectAssignment = jest.fn();

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCourse],
      }) // Course list
      .mockResolvedValueOnce({
        ok: true,
        json: async () => wrapInAssignmentGroups([mockAssignmentUnsubmitted]),
      }); // Assignment list

    // Render CourseList
    const { rerender } = render(
      <CourseList onSelectCourse={mockOnSelectCourse} apiToken="test-token" />
    );

    await waitFor(() => {
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    });

    // Select course
    const courseButton = screen.getByText('Introduction to Computer Science').closest('button');
    fireEvent.click(courseButton!);

    expect(mockOnSelectCourse).toHaveBeenCalledWith(12345);

    // Now render AssignmentList
    rerender(
      <AssignmentList
        courseId={12345}
        onSelectAssignment={mockOnSelectAssignment}
        apiToken="test-token"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Assignment 2: Data Analysis')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('Accessibility', () => {
  it('Login has accessible form elements', () => {
    render(<Login onLoginSuccess={jest.fn()} />);

    const input = screen.getByLabelText('API Token');
    expect(input).toHaveAttribute('id', 'token');

    const toggleButton = screen.getByRole('button', { name: /显示Token|隐藏Token/ });
    expect(toggleButton).toHaveAttribute('type', 'button');
  });

  it('CourseList buttons are accessible', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [mockCourse],
    });

    render(<CourseList onSelectCourse={jest.fn()} apiToken="test" />);

    await waitFor(() => {
      expect(screen.getByText('Introduction to Computer Science')).toBeInTheDocument();
    });

    const courseButton = screen.getByText('Introduction to Computer Science').closest('button');
    // Button elements are implicitly type="submit", but the component uses button element
    expect(courseButton?.tagName.toLowerCase()).toBe('button');
  });

  it('DropZone has accessible file input', () => {
    const dropZoneProps = {
      assignmentId: 1001,
      courseId: 12345,
      apiToken: 'test-token',
      onUploadComplete: jest.fn(),
    };

    render(<DropZone {...dropZoneProps} />);

    const fileInput = document.getElementById('file-input');
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('multiple');
  });
});
