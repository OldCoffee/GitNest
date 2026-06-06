import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

export interface TabBarProps {
  variant?: "default" | "preview";
  className?: string;
  children: ReactNode;
}

export function TabBar({ variant = "default", className, children }: TabBarProps) {
  return (
    <div
      className={cn(
        variant === "preview" ? "jb-preview-tab-bar" : "jb-tab-bar",
        "flex shrink-0 overflow-x-auto",
        className,
      )}
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
    >
      {children}
    </button>
  );
}

export interface TabsProps<T extends string> {
  tabs: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  variant?: "default" | "preview";
  className?: string;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  variant = "default",
  className,
}: TabsProps<T>) {
  return (
    <TabBar variant={variant} className={className}>
      {tabs.map((tab) => (
        <Tab key={tab.id} active={value === tab.id} onClick={() => onChange(tab.id)}>
          {tab.label}
        </Tab>
      ))}
    </TabBar>
  );
}
