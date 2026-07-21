import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "../../lib/utils";

type Layout = "row" | "stack";

interface BaseProps {
  selected?: boolean;
  layout?: Layout;
  className?: string;
  children: ReactNode;
}

const LAYOUT_CLASS: Record<Layout, string> = {
  row: "",
  stack: "flex-col items-start",
};

function rowClass(selected: boolean | undefined, layout: Layout, className?: string) {
  return cn("jb-list-row", LAYOUT_CLASS[layout], selected && "jb-list-row-selected", className);
}

export interface ListRowButtonProps
  extends BaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {
  as?: "button";
}

export interface ListRowAnchorProps
  extends BaseProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> {
  as: "a";
}

/** Non-interactive row chrome for rows that nest action buttons. */
export interface ListRowDivProps
  extends BaseProps,
    Omit<HTMLAttributes<HTMLDivElement>, "className" | "children"> {
  as: "div";
}

export type ListRowProps = ListRowButtonProps | ListRowAnchorProps | ListRowDivProps;

export function ListRow(props: ListRowProps) {
  const { selected, layout = "row", className, children } = props;
  const cls = rowClass(selected, layout, className);

  if (props.as === "a") {
    const { as: _as, selected: _s, layout: _l, className: _c, children: _ch, ...rest } = props;
    return (
      <a className={cls} {...rest}>
        {children}
      </a>
    );
  }

  if (props.as === "div") {
    const { as: _as, selected: _s, layout: _l, className: _c, children: _ch, ...rest } = props;
    return (
      <div className={cls} {...rest}>
        {children}
      </div>
    );
  }

  const { as: _as, selected: _s, layout: _l, className: _c, children: _ch, ...rest } =
    props as ListRowButtonProps;
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
