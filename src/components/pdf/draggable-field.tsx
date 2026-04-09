"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Pen, Type, Calendar, CheckSquare, Mail, MapPin, User, GripVertical, FileText, Building2, Phone, Hash, Globe, Map, AlignLeft, Upload, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FieldData {
  id: string;
  type: string;
  page: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  recipientId: string;
  required: boolean;
  value?: string | null;
}

interface DraggableFieldProps {
  field: FieldData;
  recipientName?: string;
  recipientColor?: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  scale?: number;
}

const fieldIcons: Record<string, typeof Pen> = {
  signature: Pen,
  initials: Type,
  date: Calendar,
  date_auto: Calendar,
  text: Type,
  checkbox: CheckSquare,
  name: User,
  email: Mail,
  address: MapPin,
  title: User,
  company: Building2,
  firstname: User,
  lastname: User,
  phone: Phone,
  suburb: MapPin,
  state: Map,
  postcode: Hash,
  country: Globe,
  custom: FileText,
  paragraph: AlignLeft,
  number: Hash,
  postcodes: Upload,
  dropdown: ChevronDown,
};

const fieldLabels: Record<string, string> = {
  signature: "Signature",
  initials: "Initials",
  date: "Date",
  date_auto: "Signing Date",
  text: "Text",
  checkbox: "Checkbox",
  name: "Name",
  email: "Email",
  address: "Address",
  title: "Title",
  company: "Company",
  firstname: "First Name",
  lastname: "Last Name",
  phone: "Phone",
  suburb: "Suburb / City",
  state: "State",
  postcode: "Postcode",
  country: "Country",
  paragraph: "Paragraph",
  number: "Number",
  postcodes: "Postcodes",
  dropdown: "Dropdown",
};

// Helper to get field type and label for custom/dropdown fields
export function getFieldTypeInfo(type: string): { baseType: string; label: string } {
  if (type.startsWith("custom:")) {
    return {
      baseType: "custom",
      label: type.substring(7), // Remove "custom:" prefix
    };
  }
  if (type.startsWith("dropdown:")) {
    const parts = type.split(":");
    return {
      baseType: "dropdown",
      label: parts[1] || "Dropdown",
    };
  }
  return {
    baseType: type,
    label: fieldLabels[type] || type,
  };
}

// Helper to extract dropdown options from the field type string
// Format: "dropdown:Label:Option1|Option2|Option3"
export function getDropdownOptions(type: string): string[] {
  if (!type.startsWith("dropdown:")) return [];
  const parts = type.split(":");
  if (parts.length < 3) return [];
  return parts[2].split("|").filter(Boolean);
}

// Color palette for recipients
export const recipientColors = [
  { bg: "bg-blue-500/20", border: "border-blue-500", text: "text-blue-700", solid: "bg-blue-500" },
  { bg: "bg-green-500/20", border: "border-green-500", text: "text-green-700", solid: "bg-green-500" },
  { bg: "bg-purple-500/20", border: "border-purple-500", text: "text-purple-700", solid: "bg-purple-500" },
  { bg: "bg-orange-500/20", border: "border-orange-500", text: "text-orange-700", solid: "bg-orange-500" },
  { bg: "bg-pink-500/20", border: "border-pink-500", text: "text-pink-700", solid: "bg-pink-500" },
  { bg: "bg-cyan-500/20", border: "border-cyan-500", text: "text-cyan-700", solid: "bg-cyan-500" },
];

type DragMode = "none" | "move" | "resize-se" | "resize-e" | "resize-s";

export function DraggableField({
  field,
  recipientName,
  recipientColor = "0",
  isSelected,
  onSelect,
  onPositionChange,
  onResize,
  onDelete,
  scale = 1,
}: DraggableFieldProps) {
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const initialSizeRef = useRef({ width: 0, height: 0 });
  const fieldRef = useRef<HTMLDivElement>(null);

  const colorIndex = parseInt(recipientColor) % recipientColors.length;
  const colors = recipientColors[colorIndex >= 0 ? colorIndex : 0];

  const { baseType, label: fieldLabel } = getFieldTypeInfo(field.type);
  const Icon = fieldIcons[baseType] || Type;

  // Handle mouse/touch move
  useEffect(() => {
    if (dragMode === "none") return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const deltaX = (clientX - dragStartRef.current.x) / scale;
      const deltaY = (clientY - dragStartRef.current.y) / scale;

      if (dragMode === "move") {
        const newX = Math.max(0, initialPosRef.current.x + deltaX);
        const newY = Math.max(0, initialPosRef.current.y + deltaY);
        onPositionChange(field.id, newX, newY);
      } else if (onResize) {
        let newWidth = initialSizeRef.current.width;
        let newHeight = initialSizeRef.current.height;

        if (dragMode === "resize-se" || dragMode === "resize-e") {
          newWidth = Math.max(50, initialSizeRef.current.width + deltaX);
        }
        if (dragMode === "resize-se" || dragMode === "resize-s") {
          newHeight = Math.max(24, initialSizeRef.current.height + deltaY);
        }

        onResize(field.id, newWidth, newHeight);
      }
    };

    const handleEnd = () => {
      setDragMode("none");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    // Add listeners to window
    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    // Prevent text selection while dragging
    document.body.style.userSelect = "none";
    if (dragMode === "move") {
      document.body.style.cursor = "move";
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [dragMode, scale, field.id, onPositionChange, onResize]);

  const startMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = { x: clientX, y: clientY };
    initialPosRef.current = { x: field.xPosition, y: field.yPosition };
    setDragMode("move");
    onSelect?.();
  };

  const startResize = (e: React.MouseEvent | React.TouchEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = { x: clientX, y: clientY };
    initialSizeRef.current = { width: field.width, height: field.height };
    setDragMode(mode);
    onSelect?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(field.id);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();
  };

  const isDragging = dragMode !== "none";

  return (
    <div
      ref={fieldRef}
      data-field-id={field.id}
      className={cn(
        "absolute border-2 rounded select-none cursor-move pointer-events-auto",
        colors.bg,
        colors.border,
        isSelected && "ring-2 ring-offset-1 ring-primary",
        isDragging && "opacity-90 z-50"
      )}
      style={{
        left: field.xPosition,
        top: field.yPosition,
        width: field.width,
        height: field.height,
        touchAction: "none",
        zIndex: isDragging ? 1000 : isSelected ? 100 : 10,
      }}
      onMouseDown={startMove}
      onTouchStart={startMove}
      onClick={handleClick}
    >
      {/* Field content - centered */}
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-xs pointer-events-none",
          colors.text
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="font-medium text-center leading-tight">
          {fieldLabel}
        </span>
        {recipientName && field.height > 50 && (
          <span className="text-[10px] opacity-70 truncate max-w-full px-1">
            {recipientName}
          </span>
        )}
      </div>

      {/* Drag handle in top-left corner */}
      <div
        className={cn(
          "absolute -top-3 -left-3 h-7 w-7 rounded-md flex items-center justify-center cursor-move shadow-md border-2 border-white z-10",
          colors.solid
        )}
        onMouseDown={startMove}
        onTouchStart={startMove}
      >
        <GripVertical className="h-4 w-4 text-white pointer-events-none" />
      </div>

      {/* Delete button in top-right corner */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -top-3 -right-3 h-7 w-7 rounded-md bg-red-500 text-white hover:bg-red-600 shadow-md border-2 border-white z-10"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Resize handles - only show when selected and onResize is provided */}
      {isSelected && onResize && (
        <>
          {/* Right edge resize */}
          <div
            className="absolute top-1/2 -right-2 w-4 h-8 -translate-y-1/2 cursor-ew-resize bg-white border-2 border-gray-400 rounded-sm hover:border-primary hover:bg-primary/10 z-10"
            onMouseDown={(e) => startResize(e, "resize-e")}
            onTouchStart={(e) => startResize(e, "resize-e")}
          />

          {/* Bottom edge resize */}
          <div
            className="absolute -bottom-2 left-1/2 h-4 w-8 -translate-x-1/2 cursor-ns-resize bg-white border-2 border-gray-400 rounded-sm hover:border-primary hover:bg-primary/10 z-10"
            onMouseDown={(e) => startResize(e, "resize-s")}
            onTouchStart={(e) => startResize(e, "resize-s")}
          />

          {/* Bottom-right corner resize */}
          <div
            className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize bg-white border-2 border-gray-400 rounded-sm hover:border-primary hover:bg-primary/10 z-10"
            onMouseDown={(e) => startResize(e, "resize-se")}
            onTouchStart={(e) => startResize(e, "resize-se")}
          />
        </>
      )}
    </div>
  );
}
