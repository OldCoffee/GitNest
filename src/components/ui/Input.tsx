import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "../../lib/utils";

import { SearchIcon } from "./icons";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className, type, ref, ...rest }: InputProps) {
  return <input ref={ref} type={type ?? "text"} className={cn("jb-input", className)} {...rest} />;
}

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  wrapClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function SearchInput({ className, wrapClassName, ref, ...rest }: SearchInputProps) {
  return (
    <div className={cn("jb-search-wrap", wrapClassName)}>
      <span className="jb-search-icon" aria-hidden>
        <SearchIcon size="sm" />
      </span>
      <input ref={ref} type="search" className={cn("jb-search", className)} {...rest} />
    </div>
  );
}
