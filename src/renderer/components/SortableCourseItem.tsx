import { useState } from 'react';
import type { Course } from '../../shared/types';

interface SortableCourseItemProps {
  course: Course;
  isSelected: boolean;
  onClick: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/**
 * 可拖拽的课程项组件
 * 使用原生 HTML5 Drag and Drop API
 */
export function SortableCourseItem({
  course,
  isSelected,
  onClick,
  onDragStart,
  onDragEnd,
}: SortableCourseItemProps): JSX.Element {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>): void => {
    // 设置拖拽数据 - 使用 String() 确保是字符串类型
    const courseIdStr = String(course.id);
    e.dataTransfer.setData('text/plain', courseIdStr);
    e.dataTransfer.effectAllowed = 'move';

    // 通知父组件拖拽开始（这会设置 data-dragging="true"）
    onDragStart?.();

    // 设置本地状态用于样式控制
    // 延迟添加拖拽样式，确保拖拽影像是原始样式
    setTimeout(() => {
      setIsDragging(true);
    }, 0);
  };

  const handleDragEnd = (): void => {
    setIsDragging(false);
    // 通知父组件拖拽结束
    onDragEnd?.();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      className={`
        sortable-item rounded-lg border p-4 cursor-move select-none
        transition-all duration-150 ease-in-out
        ${isDragging
          ? 'opacity-50 border-dashed border-blue-500 bg-blue-50'
          : 'bg-white border-gray-200 hover:shadow-md hover:border-gray-300'
        }
        ${isSelected
          ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50'
          : ''
        }
      `}
    >
      <div className="flex items-center gap-3">
        {/* 课程信息 */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium text-gray-900 ${isSelected ? '' : 'truncate'}`}>
            {course.name}
          </h3>
          <p className={`text-sm text-gray-500 ${isSelected ? '' : 'truncate'}`}>
            {course.course_code}
          </p>
        </div>
      </div>
    </div>
  );
}
