import type { ReactNode, Ref } from "react";
import { cn } from "../../lib/utils";

export type TabVariant = "default" | "preview" | "tool" | "terminal" | "editor" | "segmented";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

export interface TabBarProps {
  variant?: TabVariant;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  ref?: Ref<HTMLDivElement>;
}

function tabBarClass(variant: TabVariant): string {
  switch (variant) {
    case "preview":
      return "jb-preview-tab-bar";
    case "tool":
      return "jb-tab-bar jb-tab-bar-tool";
    case "terminal":
      return "jb-tab-bar jb-tab-bar-terminal";
    case "editor":
      return "jb-tab-bar jb-tab-bar-editor";
    case "segmented":
      return "jb-segmented";
    case "default":
    default:
      return "jb-tab-bar";
  }
}

export function TabBar({
  variant = "default",
  className,
  children,
  "aria-label": ariaLabel,
  ref,
}: TabBarProps) {
  return (
    <div
      ref={ref}
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className={cn(tabBarClass(variant), "flex shrink-0 overflow-x-auto", className)}
    >
      {children}
    </div>
  );
}

export interface TabProps {
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function Tab({ active, onClick, className, children }: TabProps) {
  return (
    <button
      type="button"
      className={cn("jb-tab whitespace-nowrap", active && "jb-tab-active", className)}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export interface TabsProps<T extends string> {
  tabs: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  variant?: TabVariant;
  className?: string;
  "aria-label"?: string;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "default",
  className,
  "aria-label": ariaLabel,
}: TabsProps<T>) {
  return (
    <TabBar variant={variant} className={className} aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <Tab key={tab.id} active={value === tab.id} onClick={() => onChange(tab.id)}>
          {tab.label}
        </Tab>
      ))}
    </TabBar>
  );
}
