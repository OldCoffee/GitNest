import type { ReactNode, SVGProps } from "react";
import { cn } from "../../lib/utils";

export type IconSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<IconSize, string> = {
  xs: "jb-icon-xs",
  sm: "jb-icon-sm",
  md: "jb-icon-md",
  lg: "jb-icon-lg",
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: IconSize;
  children?: ReactNode;
}

/** Shared 16×16 filled glyph wrapper — optical sizes via CSS. */
export function Icon({ size = "md", className, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      focusable="false"
      className={cn("jb-icon", SIZE_CLASS[size], className)}
      {...rest}
    >
      {children}
    </svg>
  );
}

function path(d: string) {
  return <path fill="currentColor" d={d} />;
}

export function ProjectIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M2.25 4.25A1.75 1.75 0 0 1 4 2.5h2.2l1.05 1.1H12a1.75 1.75 0 0 1 1.75 1.75v7A1.75 1.75 0 0 1 12 14H4A1.75 1.75 0 0 1 2.25 12.25v-8Z",
      )}
    </Icon>
  );
}

export function GitIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M8 1.6a6.4 6.4 0 1 0 0 12.8A6.4 6.4 0 0 0 8 1.6Zm0 1.2a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 8 2.8Zm-.7 2.1v2.35l1.75 1.02-.55.95L8 8.05 6.05 9.22l-.55-.95 1.75-1.02V4.9h1.05Z",
      )}
    </Icon>
  );
}

export function SearchIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M6.75 2a4.75 4.75 0 1 0 2.98 8.45l3.16 3.16 1.06-1.06-3.16-3.16A4.75 4.75 0 0 0 6.75 2Zm0 1.5a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Z",
      )}
    </Icon>
  );
}

export function TerminalIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11A1.5 1.5 0 0 0 15 11.5v-7A1.5 1.5 0 0 0 13.5 3h-11Zm1.55 2.35 2.35 2.15-2.35 2.15-.9-1 1.25-1.15-1.25-1.15.9-1ZM8 9h3.25v1.25H8V9Z",
      )}
    </Icon>
  );
}

export function ConsoleIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M2.5 2.5h11A1.5 1.5 0 0 1 15 4v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12V4a1.5 1.5 0 0 1 1.5-1.5Zm0 1.5v1.25h11V4h-11Zm0 2.75V12h11V7.25h-11ZM4 8.25h5v1.1H4v-1.1Zm0 2.1h7v1.1H4v-1.1Z",
      )}
    </Icon>
  );
}

export function CloseIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M4.22 3.16 8 6.94l3.78-3.78 1.06 1.06L9.06 8l3.78 3.78-1.06 1.06L8 9.06l-3.78 3.78-1.06-1.06L6.94 8 3.16 4.22l1.06-1.06Z",
      )}
    </Icon>
  );
}

export function RefreshIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M8 2.25a5.75 5.75 0 0 1 5.55 4.25H11.9A4.25 4.25 0 0 0 4.4 8.7L3.1 7.5 1.85 6.4l2.7-2.35A5.75 5.75 0 0 1 8 2.25Zm0 11.5a5.75 5.75 0 0 1-5.55-4.25H4.1A4.25 4.25 0 0 0 11.6 7.3l1.3 1.2 1.25 1.1-2.7 2.35A5.75 5.75 0 0 1 8 13.75Z",
      )}
    </Icon>
  );
}

export function SettingsIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M8 5.35a2.65 2.65 0 1 0 0 5.3 2.65 2.65 0 0 0 0-5.3Zm0 1.4a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM6.95 1.6h2.1l.28 1.45c.42.14.8.34 1.15.58l1.38-.55.95 1.65-1.1 1c.06.22.1.45.1.7s-.04.48-.1.7l1.1 1-.95 1.65-1.38-.55c-.35.24-.73.44-1.15.58L9.05 14.4H6.95l-.28-1.45a4.7 4.7 0 0 1-1.15-.58l-1.38.55-.95-1.65 1.1-1a3.6 3.6 0 0 1-.1-.7c0-.25.04-.48.1-.7l-1.1-1 .95-1.65 1.38.55c.35-.24.73-.44 1.15-.58L6.95 1.6Z",
      )}
    </Icon>
  );
}

export function FetchIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M8 2a6 6 0 0 1 5.7 4.1h-1.55A4.5 4.5 0 0 0 3.5 8H5L2.7 10.8.4 8H2a6 6 0 0 1 6-6Zm5.3 5.2L15.7 10l-2.4-2.8H12a4.5 4.5 0 0 1-8.6 2h1.55A3 3 0 0 0 12 8h1.3Z",
      )}
    </Icon>
  );
}

export function PullIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M7.25 2v6.2L5.05 6 4 7.05 8 11.1l4-4.05L10.95 6 8.75 8.2V2h-1.5ZM3 12.4h10V14H3v-1.6Z",
      )}
    </Icon>
  );
}

export function PushIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M8 4.9 5.8 7.1 4.75 6.05 8 2.8l3.25 3.25L10.2 7.1 8 4.9v6.25H6.5V4.9H8ZM3 12.4h10V14H3v-1.6Z",
      )}
    </Icon>
  );
}

export function ExternalLinkIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M6 3.4h6.6v6.6h-1.4V6.05L6.55 10.7 5.5 9.65 9.95 5.2H6V3.4Z",
      )}
    </Icon>
  );
}

export function NewWindowIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M2.5 3.5A1.5 1.5 0 0 1 4 2h5.2v1.4H4v8.2h8.2V7H13.6v4.7A1.5 1.5 0 0 1 12.1 13.2H4A1.5 1.5 0 0 1 2.5 11.7v-8.2Zm9.1.4V2H13.6v3.5h-1.4V4.45L8.55 7.5 7.5 6.45 10.55 3.4H9.5V2h4.1v.001Z",
      )}
    </Icon>
  );
}

export function CloseRepoIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M9.5 2A1.5 1.5 0 0 1 11 3.5V5H9.5V3.5h-6v9h6V11H11v1.5A1.5 1.5 0 0 1 9.5 14h-6A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2h6Zm2.2 4 2.55 2.55-2.55 2.55-1.05-1.05 1.2-1.25H6.5V8.3h5.35l-1.2-1.25L11.7 6Z",
      )}
    </Icon>
  );
}

export function FolderIcon(props: Omit<IconProps, "children"> & { open?: boolean }) {
  const { open, ...rest } = props;
  return (
    <Icon {...rest}>
      {open
        ? path(
            "M1.75 4.25A1.75 1.75 0 0 1 3.5 2.5h2.35l1 1.05H9.5v1.15H4.1l-.85 6.1h9.4l.55-3.85H5.2V5.8h8.85c.85 0 1.5.75 1.38 1.6l-.85 6A1.5 1.5 0 0 1 13.1 14.5H3.35A1.6 1.6 0 0 1 1.75 13L1.75 4.25Z",
          )
        : path(
            "M2.25 4.25A1.75 1.75 0 0 1 4 2.5h2.2l1.05 1.1H12a1.75 1.75 0 0 1 1.75 1.75v7A1.75 1.75 0 0 1 12 14H4A1.75 1.75 0 0 1 2.25 12.25v-8Z",
          )}
    </Icon>
  );
}

export function FileIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M4.25 1.75h5.1L12.5 5v8.25A1.5 1.5 0 0 1 11 14.75H4.25A1.5 1.5 0 0 1 2.75 13.25V3.25A1.5 1.5 0 0 1 4.25 1.75Zm4.85 1.4v2.4h2.35L9.1 3.15Z",
      )}
    </Icon>
  );
}

export function LocateIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M8 2.4a5.6 5.6 0 0 1 5.6 5.6c0 1.95-1.05 3.65-2.6 4.55L8 14.7l-3-2.15A5.6 5.6 0 1 1 8 2.4Zm0 1.5a4.1 4.1 0 1 0 0 8.2 4.1 4.1 0 0 0 0-8.2Zm0 1.8a.8.8 0 0 1 .8.8v1.75l1.3.75-.7 1.25-1.9-1.1V6.5a.8.8 0 0 1 .8-.8Z",
      )}
    </Icon>
  );
}

export function ExpandAllIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path("M3.75 7.1 8 2.85l4.25 4.25H9.7V9.4H6.3V7.1H3.75Zm0 1.8 4.25 4.25 4.25-4.25H9.7V6.6H6.3v2.3H3.75Z")}
    </Icon>
  );
}

export function CollapseAllIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path("M3.75 8.9 8 4.65l4.25 4.25H9.7V13H6.3V8.9H3.75Zm0-1.8 4.25-4.25 4.25 4.25H9.7V7.4H6.3V3.1H3.75Z")}
    </Icon>
  );
}

export function MemoryIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M3 4.5h10A1.5 1.5 0 0 1 14.5 6v3A1.5 1.5 0 0 1 13 10.5H3A1.5 1.5 0 0 1 1.5 9V6A1.5 1.5 0 0 1 3 4.5Zm0 1.5v3h10V6H3Zm.5 5.5H5V13H3.5v-1.5Zm3.75 0h1.5V13h-1.5v-1.5Zm3.75 0H12.5V13H11v-1.5ZM4 7h1.5v1H4V7Zm3.25 0h1.5v1h-1.5V7ZM10.5 7H12v1h-1.5V7Z",
      )}
    </Icon>
  );
}

export function CpuIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M6 1.5h1V3H6V1.5Zm3 0h1V3H9V1.5ZM4.5 4.5h7v7h-7v-7Zm1.5 1.5v4h4V6H6Zm-4.5 0H3v1H1.5V6Zm0 3H3v1H1.5V9ZM13 6h1.5v1H13V6Zm0 3h1.5v1H13V9ZM6 13h1v1.5H6V13Zm3 0h1v1.5H9V13Z",
      )}
    </Icon>
  );
}

export function BellIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M8 1.75a3.25 3.25 0 0 0-3.25 3.25v1.2c0 .55-.18 1.09-.5 1.54L3.3 9.3A.75.75 0 0 0 3.9 10.5h8.2a.75.75 0 0 0 .6-1.2l-.95-1.56a2.75 2.75 0 0 1-.5-1.54V5A3.25 3.25 0 0 0 8 1.75Zm-1.75 9.5a1.75 1.75 0 1 0 3.5 0h-3.5Z",
      )}
    </Icon>
  );
}

export function TrashIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M6.5 2h3l.5 1H13v1.4H3V3h2.5l.5-1Zm-2 3.4h7l-.55 7A1.5 1.5 0 0 1 9.45 14H6.55a1.5 1.5 0 0 1-1.5-1.4L4.5 5.4Z",
      )}
    </Icon>
  );
}

export function ChevronRightIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path("M5.7 3.2 10.5 8 5.7 12.8 4.6 11.7 8.3 8 4.6 4.3l1.1-1.1Z")}
    </Icon>
  );
}

export function ChevronDownIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path("M3.2 5.7 8 10.5 12.8 5.7 11.7 4.6 8 8.3 4.3 4.6l-1.1 1.1Z")}
    </Icon>
  );
}

export function TagIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M2.5 2.5h5.3l.7.7 5 5v.1l-4.1 4.1h-.1l-5-5-.7-.7V2.5Zm2.2 1.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
      )}
    </Icon>
  );
}


export function PlusIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path("M7.25 3.25v3.5h-3.5v1.5h3.5v3.5h1.5v-3.5h3.5v-1.5h-3.5v-3.5h-1.5Z")}
    </Icon>
  );
}

export function CheckIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path("M6.4 10.55 3.7 7.85l1.06-1.06 1.64 1.64 4.24-4.24 1.06 1.06-5.3 5.3Z")}
    </Icon>
  );
}

/** Two-node git branch glyph used in branch trees. */
export function BranchNodeIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M4.5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM5.5 7.5h5v1.5H9.8L8.5 12H6.7l1.3-3H5.5V7.5Z",
      )}
    </Icon>
  );
}

export function BranchTagIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path(
        "M3.5 2h4.2l.8.8 4.5 4.5V13a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-2H6v2a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z",
      )}
    </Icon>
  );
}

export function ArrowIncomingIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path("M10.75 3.25 6.5 7.5h2.25V12l-1.06-1.06L4.69 7.94 8.63 4l1.06 1.06V3.25h1.06Z")}
    </Icon>
  );
}

export function ArrowOutgoingIcon(props: Omit<IconProps, "children">) {
  return (
    <Icon {...props}>
      {path("M5.25 12.75 9.5 8.5H7.25V4l1.06 1.06 2 2L7.37 11l-1.06-1.06v2.81H5.25Z")}
    </Icon>
  );
}
