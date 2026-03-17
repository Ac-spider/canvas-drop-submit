/**
 * Canvas Drop Submit - 共享类型定义
 * @module shared/types
 * @description 包含所有Canvas API相关的类型定义、联合类型和类型守卫函数
 */

// ============================================================================
// 基础类型和联合类型
// ============================================================================

/**
 * Canvas API 支持的提交类型
 * @see https://canvas.instructure.com/doc/api/assignments.html
 */
export type SubmissionType =
  | 'online_upload'
  | 'online_text_entry'
  | 'online_url'
  | 'media_recording'
  | 'student_annotation'
  | 'none'
  | 'on_paper'
  | 'external_tool'

/**
 * 作业评分类型
 */
export type GradingType =
  | 'pass_fail'
  | 'percent'
  | 'letter_grade'
  | 'gpa_scale'
  | 'points'
  | 'not_graded'

/**
 * 提交状态
 */
export type SubmissionWorkflowState =
  | 'submitted'
  | 'unsubmitted'
  | 'graded'
  | 'pending_review'

/**
 * 课程生命周期状态
 */
export type CourseWorkflowState =
  | 'unpublished'
  | 'available'
  | 'completed'
  | 'deleted'

/**
 * 注册状态
 */
export type EnrollmentState =
  | 'active'
  | 'invited'
  | 'accepted'
  | 'inactive'
  | 'completed'
  | 'rejected'

/**
 * 作业分类筛选
 */
export type AssignmentBucket =
  | 'upcoming'
  | 'overdue'
  | 'undated'
  | 'ungraded'
  | 'past'
  | 'future'

// ============================================================================
// 用户相关类型
// ============================================================================

/**
 * 用户简要信息（用于显示）
 */
export interface UserDisplay {
  /** 用户唯一标识符 */
  id: number
  /** 用户显示名称 */
  display_name: string
  /** 头像图片URL */
  avatar_image_url?: string
}

/**
 * 学期/学期信息
 */
export interface Term {
  /** 学期唯一标识符 */
  id: number
  /** 学期名称（如 "2024 Spring"） */
  name: string
}

/**
 * 注册信息
 */
export interface Enrollment {
  /** 注册类型（如 "StudentEnrollment", "TeacherEnrollment"） */
  type: string
  /** 注册状态 */
  enrollment_state: EnrollmentState
  /** 用户角色 */
  role: string
  /** 角色ID */
  role_id: number
  /** 用户ID */
  user_id: number
  /** 课程ID */
  course_id: number
  /** 课程区域ID */
  course_section_id?: number
}

// ============================================================================
// 课程相关类型
// ============================================================================

/**
 * Canvas课程对象
 * @see https://canvas.instructure.com/doc/api/courses.html
 */
export interface Course {
  /** 课程唯一标识符 */
  id: number
  /** 课程显示名称 */
  name: string
  /** 课程代码（如 "CS101"） */
  course_code: string
  /** 课程教师列表 */
  teachers?: UserDisplay[]
  /** 当前用户的注册信息 */
  enrollments?: Enrollment[]
  /** 所属学期 */
  term?: Term
  /** 课程开始时间（ISO 8601格式） */
  start_at?: string
  /** 课程结束时间（ISO 8601格式） */
  end_at?: string
  /** 课程生命周期状态 */
  workflow_state?: CourseWorkflowState
}

// ============================================================================
// 作业相关类型
// ============================================================================

/**
 * 作业提交信息
 * @see https://canvas.instructure.com/doc/api/submissions.html
 */
export interface Submission {
  /** 提交唯一标识符 */
  id: number
  /** 提交类型 */
  submission_type: SubmissionType
  /** 提交时间（ISO 8601格式） */
  submitted_at: string
  /** 提交工作流状态 */
  workflow_state: SubmissionWorkflowState
  /** 是否逾期提交 */
  late: boolean
  /** 是否缺交 */
  missing: boolean
  /** 得分 */
  score?: number
  /** 等级（如 "A", "B+" 或具体分数） */
  grade?: string
  /** 文本提交内容 */
  body?: string
  /** 附件列表 */
  attachments?: FileAttachment[]
}

/**
 * Canvas作业对象
 * @see https://canvas.instructure.com/doc/api/assignments.html
 */
export interface Assignment {
  /** 作业唯一标识符 */
  id: number
  /** 作业名称 */
  name: string
  /** 作业描述（HTML格式） */
  description?: string
  /** 截止时间（ISO 8601格式） */
  due_at?: string
  /** 锁定时间（ISO 8601格式，之后无法提交） */
  lock_at?: string
  /** 解锁时间（ISO 8601格式，之前无法查看） */
  unlock_at?: string
  /** 允许的提交类型列表 */
  submission_types: SubmissionType[]
  /** 是否已有学生提交 */
  has_submitted_submissions: boolean
  /** 当前用户的提交信息 */
  submission?: Submission
  /** 满分分值 */
  points_possible?: number
  /** 评分类型 */
  grading_type?: GradingType
  /** 允许上传的文件扩展名列表（如 [".pdf", ".doc"]） */
  allowed_extensions?: string[]
}

// ============================================================================
// 文件上传相关类型
// ============================================================================

/**
 * 文件附件信息
 */
export interface FileAttachment {
  /** 文件唯一标识符 */
  id: number
  /** 文件显示名称 */
  display_name: string
  /** 文件访问URL */
  url: string
  /** 文件大小（字节） */
  size: number
  /** 文件MIME类型 */
  content_type?: string
  /** 创建时间 */
  created_at?: string
  /** 修改时间 */
  updated_at?: string
}

/**
 * 文件上传预请求响应
 * @description Canvas文件上传三步流程的第一步响应
 * @see https://canvas.instructure.com/doc/api/file_uploads.html
 */
export interface FileUploadPreResponse {
  /** S3上传URL */
  upload_url: string
  /** 上传表单参数（包含签名等） */
  upload_params: Record<string, string>
}

/**
 * 文件上传确认响应
 * @description Canvas文件上传三步流程的第三步响应
 */
export interface FileUploadConfirmResponse {
  /** 文件唯一标识符 */
  id: number
  /** 文件访问URL */
  url: string
  /** 文件显示名称 */
  display_name: string
  /** 文件大小（字节） */
  size?: number
  /** 文件MIME类型 */
  content_type?: string
}

/**
 * 本地文件信息（用于拖拽上传）
 */
export interface LocalFileInfo {
  /** 文件路径 */
  path: string
  /** 文件名称 */
  name: string
  /** 文件大小（字节） */
  size: number
  /** 文件类型 */
  type: string
}

// ============================================================================
// API 响应和错误类型
// ============================================================================

/**
 * Canvas API 错误详情
 */
export interface CanvasAPIErrorDetail {
  /** 错误消息 */
  message: string
}

/**
 * Canvas API 错误响应
 */
export interface CanvasAPIError {
  /** 错误消息 */
  message: string
  /** 详细错误列表 */
  errors?: CanvasAPIErrorDetail[]
  /** 错误状态码 */
  status?: number
}

/**
 * API 响应包装器（泛型）
 * @template T 响应数据类型
 */
export interface APIResponse<T> {
  /** 是否成功 */
  success: boolean
  /** 响应数据 */
  data?: T
  /** 错误信息 */
  error?: CanvasAPIError
  /** 响应状态码 */
  statusCode: number
}

/**
 * 分页响应包装器
 * @template T 列表项类型
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  data: T[]
  /** 是否有下一页 */
  hasMore: boolean
  /** 下一页链接（如果有） */
  nextLink?: string
  /** 总数量（如果API提供） */
  total?: number
}

// ============================================================================
// 应用状态类型
// ============================================================================

/**
 * 拖拽状态
 */
export type DragState = 'idle' | 'dragover' | 'dragenter' | 'drop' | 'error'

/**
 * 上传状态
 */
export type UploadState =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'confirming'
  | 'submitting'
  | 'completed'
  | 'error'

/**
 * 应用主题
 */
export type AppTheme = 'light' | 'dark' | 'system'

/**
 * 用户设置
 */
export interface UserSettings {
  /** API Token（加密存储） */
  apiToken?: string
  /** 主题设置 */
  theme: AppTheme
  /** 是否显示已提交作业 */
  showSubmittedAssignments: boolean
  /** 默认文件保存路径 */
  defaultDownloadPath?: string
  /** 课程独立的下载路径映射（课程ID -> 下载路径） */
  courseDownloadPaths?: Record<number, string>
}

/**
 * 应用状态
 */
export interface AppState {
  /** 是否已登录 */
  isAuthenticated: boolean
  /** 当前选中的课程ID */
  selectedCourseId?: number
  /** 当前选中的作业ID */
  selectedAssignmentId?: number
  /** 全局加载状态 */
  isLoading: boolean
  /** 全局错误消息 */
  errorMessage?: string
}

// ============================================================================
// Electron IPC 通信类型
// ============================================================================

/**
 * IPC 通道名称
 */
export type IPCChannel =
  | 'store:get'
  | 'store:set'
  | 'store:delete'
  | 'file:read'
  | 'file:validate'
  | 'dialog:showError'
  | 'app:openExternal'

/**
 * IPC 请求载荷
 */
export interface IPCRequest<T = unknown> {
  /** 请求ID */
  id: string
  /** 请求数据 */
  payload: T
}

/**
 * IPC 响应载荷
 */
export interface IPCResponse<T = unknown> {
  /** 是否成功 */
  success: boolean
  /** 响应数据 */
  data?: T
  /** 错误信息 */
  error?: string
}

// ============================================================================
// 类型守卫函数
// ============================================================================

/**
 * 检查值是否为有效的提交类型
 * @param value - 要检查的值
 * @returns 是否为有效的提交类型
 */
export function isSubmissionType(value: unknown): value is SubmissionType {
  const validTypes: SubmissionType[] = [
    'online_upload',
    'online_text_entry',
    'online_url',
    'media_recording',
    'student_annotation',
    'none',
    'on_paper',
    'external_tool'
  ]
  return typeof value === 'string' && validTypes.includes(value as SubmissionType)
}

/**
 * 检查值是否为有效的课程对象
 * @param value - 要检查的值
 * @returns 是否为有效的课程对象
 */
export function isCourse(value: unknown): value is Course {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Course).id === 'number' &&
    'name' in value &&
    typeof (value as Course).name === 'string' &&
    'course_code' in value &&
    typeof (value as Course).course_code === 'string'
  )
}

/**
 * 检查值是否为有效的作业对象
 * @param value - 要检查的值
 * @returns 是否为有效的作业对象
 */
export function isAssignment(value: unknown): value is Assignment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Assignment).id === 'number' &&
    'name' in value &&
    typeof (value as Assignment).name === 'string' &&
    'submission_types' in value &&
    Array.isArray((value as Assignment).submission_types) &&
    'has_submitted_submissions' in value &&
    typeof (value as Assignment).has_submitted_submissions === 'boolean'
  )
}

/**
 * 检查值是否为有效的提交对象
 * @param value - 要检查的值
 * @returns 是否为有效的提交对象
 */
export function isSubmission(value: unknown): value is Submission {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Submission).id === 'number' &&
    'submission_type' in value &&
    typeof (value as Submission).submission_type === 'string' &&
    'submitted_at' in value &&
    typeof (value as Submission).submitted_at === 'string' &&
    'workflow_state' in value &&
    typeof (value as Submission).workflow_state === 'string' &&
    'late' in value &&
    typeof (value as Submission).late === 'boolean' &&
    'missing' in value &&
    typeof (value as Submission).missing === 'boolean'
  )
}

/**
 * 检查值是否为有效的文件附件对象
 * @param value - 要检查的值
 * @returns 是否为有效的文件附件对象
 */
export function isFileAttachment(value: unknown): value is FileAttachment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as FileAttachment).id === 'number' &&
    'display_name' in value &&
    typeof (value as FileAttachment).display_name === 'string' &&
    'url' in value &&
    typeof (value as FileAttachment).url === 'string' &&
    'size' in value &&
    typeof (value as FileAttachment).size === 'number'
  )
}

/**
 * 检查值是否为有效的Canvas文件对象
 * @param value - 要检查的值
 * @returns 是否为有效的Canvas文件对象
 */
export function isCanvasFile(value: unknown): value is CanvasFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as CanvasFile).id === 'number' &&
    'uuid' in value &&
    typeof (value as CanvasFile).uuid === 'string' &&
    'display_name' in value &&
    typeof (value as CanvasFile).display_name === 'string' &&
    'filename' in value &&
    typeof (value as CanvasFile).filename === 'string' &&
    'url' in value &&
    typeof (value as CanvasFile).url === 'string' &&
    'size' in value &&
    typeof (value as CanvasFile).size === 'number' &&
    'mime_class' in value &&
    typeof (value as CanvasFile).mime_class === 'string'
  )
}

/**
 * 根据mime_class获取文件类型筛选类别
 * @param mimeClass - MIME类别
 * @returns 文件筛选类型
 */
export function getFileFilterType(mimeClass: string): FileFilterType {
  const pdfTypes = ['pdf']
  const imageTypes = ['image', 'jpeg', 'png', 'gif', 'bmp', 'svg']
  const documentTypes = ['doc', 'docx', 'word', 'text', 'txt', 'rtf', 'odt']
  const codeTypes = ['code', 'html', 'css', 'js', 'json', 'xml', 'zip']

  if (pdfTypes.includes(mimeClass)) return 'pdf'
  if (imageTypes.includes(mimeClass)) return 'image'
  if (documentTypes.includes(mimeClass)) return 'document'
  if (codeTypes.includes(mimeClass)) return 'code'
  return 'other'
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 检查值是否为有效的Canvas API错误
 * @param value - 要检查的值
 * @returns 是否为有效的Canvas API错误
 */
export function isCanvasAPIError(value: unknown): value is CanvasAPIError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as CanvasAPIError).message === 'string'
  )
}

/**
 * 检查值是否为有效的API响应
 * @template T 预期的数据类型
 * @param value - 要检查的值
 * @param dataGuard - 数据类型的类型守卫函数（可选）
 * @returns 是否为有效的API响应
 */
export function isAPIResponse<T>(
  value: unknown,
  dataGuard?: (data: unknown) => data is T
): value is APIResponse<T> {
  const isBaseResponse =
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as APIResponse<T>).success === 'boolean' &&
    'statusCode' in value &&
    typeof (value as APIResponse<T>).statusCode === 'number'

  if (!isBaseResponse) return false

  const response = value as APIResponse<T>

  // 如果提供了数据守卫，验证数据
  if (dataGuard && response.data !== undefined) {
    return dataGuard(response.data)
  }

  return true
}

/**
 * 检查作业是否支持文件上传
 * @param assignment - 作业对象
 * @returns 是否支持文件上传
 */
export function supportsFileUpload(assignment: Assignment): boolean {
  return assignment.submission_types.includes('online_upload')
}

/**
 * 检查作业是否已提交
 * @param assignment - 作业对象
 * @returns 是否已提交
 */
export function isAssignmentSubmitted(assignment: Assignment): boolean {
  return (
    assignment.submission !== undefined &&
    assignment.submission.workflow_state === 'submitted'
  )
}

/**
 * 检查作业是否已逾期
 * @param assignment - 作业对象
 * @returns 是否已逾期
 */
export function isAssignmentOverdue(assignment: Assignment): boolean {
  if (!assignment.due_at) return false
  const dueDate = new Date(assignment.due_at)
  const now = new Date()
  return dueDate < now
}

/**
 * 检查文件扩展名是否被允许
 * @param filename - 文件名
 * @param allowedExtensions - 允许的扩展名列表
 * @returns 是否被允许
 */
export function isFileExtensionAllowed(
  filename: string,
  allowedExtensions?: string[]
): boolean {
  if (!allowedExtensions || allowedExtensions.length === 0) return true

  const extension = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return allowedExtensions.some((ext) => ext.toLowerCase() === extension)
}

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 从类型中提取可选属性的键
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never
}[keyof T]

/**
 * 从类型中提取必需属性的键
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? never : K
}[keyof T]

/**
 * 部分必需类型（将部分属性设为必需）
 */
export type PartialRequired<T, K extends keyof T> = Required<Pick<T, K>> &
  Partial<Omit<T, K>>

/**
 * API请求参数类型（用于查询参数）
 */
export type APIQueryParams = Record<string, string | number | boolean | undefined>

/**
 * 课程列表查询参数
 */
export interface CourseListParams {
  /** 注册状态筛选 */
  enrollment_state?: EnrollmentState
  /** 包含的额外信息 */
  include?: Array<'teachers' | 'term' | 'total_students' | 'syllabus_body'>
  /** 每页数量 */
  per_page?: number
}

/**
 * 作业列表查询参数
 */
export interface AssignmentListParams {
  /** 作业分类筛选 */
  bucket?: AssignmentBucket
  /** 包含的额外信息 */
  include?: Array<
    'submission' | 'assignments' | 'discussion_topic' | 'all_dates' | 'overrides'
  >
  /** 每页数量 */
  per_page?: number
  /** 排序顺序 */
  order_by?: 'name' | 'due_at'
}

// ============================================================================
// 课程文件相关类型
// ============================================================================

/**
 * Canvas课程文件对象
 * @see https://canvas.instructure.com/doc/api/files.html
 */
export interface CanvasFile {
  /** 文件唯一标识符 */
  id: number
  /** 文件UUID */
  uuid: string
  /** 文件夹ID */
  folder_id: number
  /** 显示名称 */
  display_name: string
  /** 文件名 */
  filename: string
  /** MIME类型 */
  content_type: string
  /** 下载URL（需要verifier） */
  url: string
  /** 文件大小（字节） */
  size: number
  /** 创建时间 */
  created_at: string
  /** 更新时间 */
  updated_at: string
  /** 解锁时间 */
  unlock_at?: string
  /** 是否锁定 */
  locked: boolean
  /** 是否隐藏 */
  hidden: boolean
  /** 锁定时间 */
  lock_at?: string
  /** 对用户隐藏 */
  hidden_for_user: boolean
  /** 缩略图URL */
  thumbnail_url?: string
  /** 修改时间 */
  modified_at: string
  /** MIME类别（如'pdf', 'image', 'code', 'text'） */
  mime_class: string
  /** 媒体条目ID */
  media_entry_id?: string
  /** 对用户锁定 */
  locked_for_user: boolean
  /** 上传用户 */
  user?: UserDisplay
}

/**
 * 文件列表查询参数
 */
export interface FileListParams {
  /** 包含的额外信息 */
  include?: Array<'user' | 'usage_rights'>
  /** 每页数量 */
  per_page?: number
  /** 排序字段 */
  sort?: 'name' | 'size' | 'created_at' | 'updated_at'
  /** 排序顺序 */
  order?: 'asc' | 'desc'
}

/**
 * 文件类型筛选
 */
export type FileFilterType = 'all' | 'pdf' | 'image' | 'document' | 'code' | 'other'

/**
 * 作业分组规则
 */
export interface AssignmentGroupRules {
  /** 丢弃最低分数量 */
  drop_lowest?: number
  /** 丢弃最高分数量 */
  drop_highest?: number
  /** 从不丢弃的作业ID列表 */
  never_drop?: number[]
}

/**
 * 作业分组（Assignment Group）
 * @see https://canvas.instructure.com/doc/api/assignment_groups.html
 */
export interface AssignmentGroup {
  /** 分组唯一标识符 */
  id: number
  /** 分组名称（如 "平时作业"、"期末考试"） */
  name: string
  /** 排序位置 */
  position: number
  /** 分组权重（百分比） */
  group_weight: number
  /** 评分规则 */
  rules?: AssignmentGroupRules
  /** 分组下的作业列表 */
  assignments?: Assignment[]
}

/**
 * 提交作业请求参数
 */
export interface SubmitAssignmentParams {
  /** 提交类型 */
  submission_type: SubmissionType
  /** 文件ID列表（当 submission_type 为 online_upload 时必需） */
  file_ids?: number[]
  /** 文本内容（当 submission_type 为 online_text_entry 时必需） */
  body?: string
  /** URL（当 submission_type 为 online_url 时必需） */
  url?: string
}

// ============================================================================
// Modules (单元) 相关类型
// ============================================================================

/**
 * 模块项目类型
 */
export type ModuleItemType =
  | 'File'
  | 'Page'
  | 'Discussion'
  | 'Assignment'
  | 'Quiz'
  | 'SubHeader'
  | 'ExternalUrl'
  | 'ExternalTool'

/**
 * 模块项目完成要求
 */
export interface ModuleItemCompletionRequirement {
  /** 完成类型 */
  type: 'must_view' | 'must_contribute' | 'must_submit' | 'min_score'
  /** 最低分数（当type为min_score时） */
  min_score?: number
  /** 是否已完成 */
  completed?: boolean
}

/**
 * 模块项目内容详情
 * 当include[]=content_details时返回
 */
export interface ModuleItemContentDetails {
  /** 满分分值 */
  points_possible?: number
  /** 截止时间 */
  due_at?: string
  /** 解锁时间 */
  unlock_at?: string
  /** 锁定时间 */
  lock_at?: string
}

/**
 * Canvas模块项目对象
 * @see https://canvas.instructure.com/doc/api/module_items.html
 */
export interface ModuleItem {
  /** 项目唯一标识符 */
  id: number
  /** 项目标题 */
  title: string
  /** 排序位置 */
  position: number
  /** 缩进级别 */
  indent: number
  /** 项目类型 */
  type: ModuleItemType
  /** 内容ID（如文件ID、作业ID等，根据type不同） */
  content_id?: number
  /** HTML页面URL */
  html_url: string
  /** API URL */
  url: string
  /** 页面URL（当type为Page时） */
  page_url?: string
  /** 外部URL（当type为ExternalUrl或ExternalTool时） */
  external_url?: string
  /** 是否在新标签页打开 */
  new_tab?: boolean
  /** 完成要求 */
  completion_requirement?: ModuleItemCompletionRequirement
  /** 内容详情 */
  content_details?: ModuleItemContentDetails
}

/**
 * Canvas模块对象
 * @see https://canvas.instructure.com/doc/api/modules.html
 */
export interface CanvasModule {
  /** 模块唯一标识符 */
  id: number
  /** 模块名称 */
  name: string
  /** 排序位置 */
  position: number
  /** 解锁时间 */
  unlock_at?: string
  /** 是否需要顺序完成 */
  require_sequential_progress: boolean
  /** 模块状态 */
  state: 'active' | 'completed' | 'locked' | 'unlocked' | 'started'
  /** 模块项目列表（当include[]=items时） */
  items?: ModuleItem[]
}
