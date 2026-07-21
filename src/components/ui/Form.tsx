import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/utils";

export interface FormFieldProps {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, hint, htmlFor, className, children }: FormFieldProps) {
  return (
    <label className={cn("jb-field", className)} htmlFor={htmlFor}>
      <span className="jb-field-label">{label}</span>
      {children}
      {hint != null && <span className="jb-field-hint">{hint}</span>}
    </label>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Checkbox({ label, className, ref, ...rest }: CheckboxProps) {
  return (
    <label className={cn("jb-checkbox-row", className)}>
      <input ref={ref} type="checkbox" className="jb-checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={cn("jb-select", className)} {...rest}>
      {children}
    </select>
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function TextArea({ className, ...rest }: TextAreaProps) {
  return <textarea className={cn("jb-textarea", className)} {...rest} />;
}
