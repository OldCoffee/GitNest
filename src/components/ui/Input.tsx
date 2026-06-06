import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...rest }: InputProps) {
  return <input type={type ?? "text"} className={cn("jb-input", className)} {...rest} />;
}

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  wrapClassName?: string;
}

export function SearchInput({ className, wrapClassName, ...rest }: SearchInputProps) {
  return (
    <div className={cn("jb-search-wrap", wrapClassName)}>
      <span className="jb-search-icon" aria-hidden>
        {"\u2315"}
      </span>
      <input type="search" className={cn("jb-search", className)} {...rest} />
    </div>
  );
}
